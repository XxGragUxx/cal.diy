import { generateFatturaPA } from "./generateFatturaPA";
import { sendInvoiceToAruba } from "./sendArubaInvoice";
import { eventTypeAppMetadataOptionalSchema } from "@calcom/app-store/zod-utils";
import { sendScheduledEmailsAndSMS } from "@calcom/emails/email-manager";
import { doesBookingRequireConfirmation } from "@calcom/features/bookings/lib/doesBookingRequireConfirmation";
import EventManager, { placeholderCreatedEvent } from "@calcom/features/bookings/lib/EventManager";
import { getAllCredentialsIncludeServiceAccountKey } from "@calcom/features/bookings/lib/getAllCredentialsForUsersOnEvent/getAllCredentials";
import { handleBookingRequested } from "@calcom/features/bookings/lib/handleBookingRequested";
import { handleConfirmation } from "@calcom/features/bookings/lib/handleConfirmation";
import { getBooking } from "@calcom/features/bookings/lib/payment/getBooking";
import { getPlatformParams } from "@calcom/features/platform-oauth-client/get-platform-params";
import { PlatformOAuthClientRepository } from "@calcom/features/platform-oauth-client/platform-oauth-client.repository";
import tasker from "@calcom/features/tasker";
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import sendPayload from "@calcom/features/webhooks/lib/sendOrSchedulePayload";
import type { EventPayloadType, EventTypeInfo } from "@calcom/features/webhooks/lib/sendPayload";
import { getVideoCallUrlFromCalEvent } from "@calcom/lib/CalEventParser";
import { getTeamIdFromEventType } from "@calcom/lib/getTeamIdFromEventType";
import { HttpError as HttpCode } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import type { TraceContext } from "@calcom/lib/tracing";
import { distributedTracing } from "@calcom/lib/tracing/factory";
import prisma from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import { BookingStatus, WebhookTriggerEvents } from "@calcom/prisma/enums";
import type { EventTypeMetadata } from "@calcom/prisma/zod-utils";

const log = logger.getSubLogger({ prefix: ["[handlePaymentSuccess]"] });

export async function handlePaymentSuccess(params: {
  paymentId: number;
  appSlug: string;
  bookingId: number;
  traceContext: TraceContext;
}) {
  const { paymentId, bookingId, appSlug, traceContext } = params;
  const updatedTraceContext = distributedTracing.updateTrace(traceContext, {
    bookingId,
    paymentId,
  });
  log.debug(`handling payment success for bookingId ${bookingId}`);
  const { booking, user: userWithCredentials, evt, eventType } = await getBooking(bookingId);
  try {
    await tasker.cancelWithReference(booking.uid, "sendAwaitingPaymentEmail");
    log.debug(`Cancelled scheduled awaiting payment email for booking ${bookingId}`);
  } catch (error) {
    log.warn(
      { bookingId, error },
      `Failed to cancel awaiting payment task - email may still be sent but will be suppressed by task handler`
    );
  }

  if (booking.location) evt.location = booking.location;

  const bookingData: Prisma.BookingUpdateInput = {
    paid: true,
    status: BookingStatus.ACCEPTED,
  };

  const allCredentials = await getAllCredentialsIncludeServiceAccountKey(userWithCredentials, {
    ...booking.eventType,
    metadata: booking.eventType?.metadata as EventTypeMetadata,
  });

  const isConfirmed = booking.status === BookingStatus.ACCEPTED;

  const platformOAuthClientRepository = new PlatformOAuthClientRepository();
  const platformOAuthClient = userWithCredentials.isPlatformManaged
    ? await platformOAuthClientRepository.getByUserId(userWithCredentials.id)
    : null;
  const areCalendarEventsEnabled = platformOAuthClient?.areCalendarEventsEnabled ?? true;
  const areEmailsEnabled = platformOAuthClient?.areEmailsEnabled ?? true;

  if (isConfirmed) {
    const apps = eventTypeAppMetadataOptionalSchema.parse(eventType?.metadata?.apps);
    const eventManager = new EventManager({ ...userWithCredentials, credentials: allCredentials }, apps);
    const scheduleResult = areCalendarEventsEnabled
      ? await eventManager.create(evt)
      : placeholderCreatedEvent;
    bookingData.references = { create: scheduleResult.referencesToCreate };

    // Populate videoCallData from Google Calendar Meet link
    const googleCalRef = scheduleResult.referencesToCreate.find(
      (ref) => ref.type === "google_calendar" && ref.meetingUrl
    );
    if (googleCalRef?.meetingUrl && !evt.videoCallData) {
      evt.videoCallData = {
        type: "google_calendar",
        id: googleCalRef.uid,
        password: googleCalRef.meetingPassword || "",
        url: googleCalRef.meetingUrl,
      };
    }
  }

  const requiresConfirmation = doesBookingRequireConfirmation({
    booking: {
      ...booking,
      eventType,
    },
  });

  if (requiresConfirmation) {
    delete bookingData.status;
  }
  const paymentUpdate = prisma.payment.update({
    where: {
      id: paymentId,
    },
    data: {
      success: true,
    },
    select: {
      id: true,
      externalId: true,
    },
  });

  const bookingUpdate = prisma.booking.update({
    where: {
      id: booking.id,
    },
    data: bookingData,
    select: {
      status: true,
    },
  });

  const [payment, updatedBooking] = await prisma.$transaction([paymentUpdate, bookingUpdate]);

  const platformClientParams = platformOAuthClient ? getPlatformParams(platformOAuthClient) : undefined;
  const teamId = await getTeamIdFromEventType({
    eventType: {
      team: { id: booking.eventType?.teamId ?? null },
      parentId: booking.eventType?.parentId ?? null,
    },
  });
  const triggerForUser = !teamId || (teamId && booking.eventType?.parentId);
  const userId = triggerForUser ? booking.userId : null;

  try {
    const paymentExternalId = payment.externalId;

    const paymentMetadata = {
      identifier: "cal.com",
      bookingId,
      eventTypeId: booking.eventType?.id ?? null,
      bookerEmail: evt.attendees[0].email,
      eventTitle: booking.eventType?.title ?? null,
      externalId: paymentExternalId ?? null,
    };

    const eventTypeInfo: EventTypeInfo = {
      eventTitle: booking.eventType?.title,
      eventDescription: booking.eventType?.description,
      requiresConfirmation: booking.eventType?.requiresConfirmation || null,
      price: booking.eventType?.price,
      currency: booking.eventType?.currency,
      length: booking.eventType?.length,
    };

    const payload: EventPayloadType = {
      ...evt,
      ...eventTypeInfo,
      bookingId,
      eventTypeId: booking.eventType?.id,
      status: updatedBooking.status,
      smsReminderNumber: booking.smsReminderNumber || undefined,
      paymentId: paymentId,
      metadata: paymentMetadata,
      ...(platformClientParams ? platformClientParams : {}),
    };

    const subscriberMeetingPaid = await getWebhooks({
      userId,
      eventTypeId: booking.eventTypeId,
      triggerEvent: WebhookTriggerEvents.BOOKING_PAID,
      teamId: booking.eventType?.teamId,
      oAuthClientId: platformClientParams?.platformClientId,
    });

    const tracingLogger = distributedTracing.getTracingLogger(updatedTraceContext);
    const bookingPaidSubscribers = subscriberMeetingPaid.map((sub) =>
      sendPayload(
        sub.secret,
        WebhookTriggerEvents.BOOKING_PAID,
        new Date().toISOString(),
        sub,
        payload
      ).catch((e) => {
        tracingLogger.error(
          `Error executing webhook for event: ${WebhookTriggerEvents.BOOKING_PAID}, URL: ${sub.subscriberUrl}, bookingId: ${evt.bookingId}, bookingUid: ${evt.uid}`,
          safeStringify(e)
        );
      })
    );

    await Promise.all(bookingPaidSubscribers);
  } catch (error) {
    log.error("Error while triggering BOOKING_PAID webhook", safeStringify(error));
  }

  if (!isConfirmed) {
    if (!requiresConfirmation) {
      await handleConfirmation({
        user: { ...userWithCredentials, credentials: allCredentials },
        evt,
        prisma,
        bookingId: booking.id,
        booking,
        paid: true,
        platformClientParams,
        traceContext: updatedTraceContext,
      });
    } else {
      await handleBookingRequested({
        evt,
        booking,
      });
      log.debug(`handling booking request for eventId ${eventType.id}`);
    }
  } else if (areEmailsEnabled) {
    await sendScheduledEmailsAndSMS({ ...evt }, undefined, undefined, undefined, eventType.metadata);
  }


    // Fatturazione elettronica automatica
  try {
    const bookingWithResponses = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: { responses: true, metadata: true },
    });

    const responses = (bookingWithResponses?.responses ?? {}) as Record<string, unknown>;
    const clientCF      = String(responses["codice-fiscale"] ?? "");
    const clientAddress = String(responses["indirizzo-residenza"] ?? "");
    const clientName    = evt.attendees[0]?.name ?? "";

    if (clientCF && clientAddress) {
      // Calcola prossimo numero fattura
      const yearSuffix = new Date().getFullYear().toString().slice(-2);
      const lastInvoice = await prisma.$queryRaw<{ invoiceNumber: string }[]>`
        SELECT metadata->>'invoiceNumber' AS "invoiceNumber"
        FROM "Booking"
        WHERE metadata->>'invoiceNumber' IS NOT NULL
        ORDER BY id DESC LIMIT 1
      `;
      const lastN = lastInvoice[0]?.invoiceNumber
        ? parseInt(lastInvoice[0].invoiceNumber.split("/")[0])
        : 10;
      const invoiceNumber = `${lastN + 1}/${yearSuffix}`;

      const xml = generateFatturaPA({
        invoiceNumber,
        date: new Date(),
        clientName,
        clientCF,
        clientAddress,
      });

      await sendInvoiceToAruba(xml);

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          metadata: {
            ...(typeof bookingWithResponses?.metadata === "object"
              ? (bookingWithResponses.metadata as object)
              : {}),
            invoiceNumber,
          },
        },
      });

      log.info(`Invoice ${invoiceNumber} generated for booking ${booking.id}`);
    } else {
      log.warn(`Booking ${booking.id}: CF or address missing, invoice skipped`);
    }
  } catch (error) {
    log.error(`Invoice generation failed for booking ${booking.id}`, error);
    // Non blocca il flusso di pagamento
  }

  throw new HttpCode({
    statusCode: 200,
    message: `Booking with id '${booking.id}' was paid and confirmed.`,
  });
}
