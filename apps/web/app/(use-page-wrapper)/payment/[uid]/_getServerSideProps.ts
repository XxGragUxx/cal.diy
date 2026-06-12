import prisma from "@calcom/prisma";

export async function getServerSideProps({ params }: { params: { uid: string } }) {
  const { uid } = params;

  if (!uid) {
    return { notFound: true as const };
  }

  const booking = await prisma.booking.findUnique({
    where: { uid },
    include: {
      payment: true,
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
  });

  if (!booking || !booking.payment.length || !booking.eventType) {
    return { notFound: true as const };
  }

  const payment = booking.payment[0];
  const eventType = booking.eventType;
  const user = eventType.users?.[0] ?? null;

  return {
    props: {
      payment: {
        id: payment.id,
        success: payment.success,
        refunded: (payment as { refunded?: boolean }).refunded ?? false,
        amount: payment.amount,
        currency: payment.currency,
        paymentOption: payment.paymentOption ?? null,
        data: (payment.data as Record<string, unknown>) ?? {},
        appId: payment.appId ?? null,
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
