import prisma from "@calcom/prisma";

export async function getServerSideProps({ params }: { params: { uid: string } }) {
  const { uid } = params;

  if (!uid) {
    return { notFound: true as const };
  }

  const paymentRecord = await prisma.payment.findUnique({
    where: { uid },
    include: {
      booking: {
        include: {
          eventType: {
            include: {
              users: {
                select: {
                  name: true,
                  username: true,
                  theme: true,
                  hideBranding: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!paymentRecord || !paymentRecord.booking || !paymentRecord.booking.eventType) {
    return { notFound: true as const };
  }

  const booking = paymentRecord.booking;
  const eventType = booking.eventType;
  const user = eventType.users?.[0] ?? null;

  return {
    props: {
      payment: {
        id: paymentRecord.id,
        success: paymentRecord.success,
        refunded: (paymentRecord as { refunded?: boolean }).refunded ?? false,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        paymentOption: paymentRecord.paymentOption ?? null,
        data: (paymentRecord.data as Record<string, unknown>) ?? {},
        appId: paymentRecord.appId ?? null,
      },
      booking: {
        id: booking.id,
        uid: booking.uid,
        title: booking.title,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status,
        paid: booking.paid,
        description: booking.description ?? null,
        location: booking.location ?? null,
      },
      eventType: {
        id: eventType.id,
        title: eventType.title,
        length: eventType.length,
        price: eventType.price,
        currency: eventType.currency,
        metadata: (eventType.metadata as Record<string, unknown>) ?? null,
        successRedirectUrl: eventType.successRedirectUrl ?? null,
        forwardParamsSuccessRedirect: eventType.forwardParamsSuccessRedirect ?? null,
        recurringEvent: eventType.recurringEvent ?? null,
      },
      profile: {
        theme: user?.theme ?? null,
        hideBranding: user?.hideBranding ?? false,
      },
      user: user
        ? { name: user.name ?? null, username: user.username ?? null }
        : null,
    },
  };
}
