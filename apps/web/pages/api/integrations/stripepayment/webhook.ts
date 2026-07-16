import { handlePaymentSuccess } from "@calcom/app-store/_utils/payments/handlePaymentSuccess";
import { HttpError as HttpCode } from "@calcom/lib/http-error";
import prisma from "@calcom/prisma";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const stripeApp = await prisma.app.findUnique({
      where: { slug: "stripe" },
      select: { keys: true },
    });

    const appKeys = stripeApp?.keys as Record<string, string> | null;
    const secretKey = appKeys?.client_secret;
    const webhookSecret = appKeys?.webhook_secret;

    if (!secretKey || !webhookSecret) {
      return res.status(500).json({ message: "Stripe not configured" });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2020-08-27" });
    const rawBody = await getRawBody(req);
    const signature = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature failed:", err);
      return res.status(400).json({ message: "Webhook signature verification failed" });
    }

    const getPaymentIntentId = (event: Stripe.Event): string | null => {
      if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
        return (event.data.object as Stripe.PaymentIntent).id;
      }
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        return typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      }
      return null;
    };

    const paymentIntentId = getPaymentIntentId(event);

    if (!paymentIntentId) {
      return res.status(200).json({ received: true });
    }

    if (event.type === "payment_intent.succeeded" || event.type === "checkout.session.completed") {
      const payment = await prisma.payment.findFirst({
        where: { externalId: paymentIntentId },
        select: { id: true, bookingId: true },
      });

      if (payment?.bookingId) {
        try {
          await handlePaymentSuccess({
            paymentId: payment.id,
            appSlug: "stripe",
            bookingId: payment.bookingId,
            traceContext: {
              traceId: event.id,
              spanId: event.id,
              operation: "stripe.webhook",
            },
            arubaUsername: process.env.ARUBA_USERNAME ?? "",
            arubaPassword: process.env.ARUBA_PASSWORD ?? "",
          });
        } catch (e: unknown) {
          if (e instanceof HttpCode && e.statusCode === 200) {
            return res.status(200).json({ received: true });
          }
          throw e;
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
