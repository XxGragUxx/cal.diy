"use client";

import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useState, useMemo } from "react";

function CheckoutForm({ returnUrl }: { returnUrl: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    if (error) {
      setErrorMessage(error.message ?? "Pagamento fallito. Riprova.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <PaymentElement />
      {errorMessage && <p className="mt-3 text-sm text-red-500">{errorMessage}</p>}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="mt-4 w-full rounded-lg bg-brand-default py-3 text-center text-sm font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? "Elaborazione in corso..." : "Paga ora"}
      </button>
    </form>
  );
}

export function StripePaymentComponent({
  clientSecret,
  stripePublishableKey,
  bookingUid,
}: {
  clientSecret: string;
  stripePublishableKey: string;
  bookingUid: string;
}) {
  const stripePromise = useMemo(() => loadStripe(stripePublishableKey), [stripePublishableKey]);
  const returnUrl = `${window.location.origin}/booking/${bookingUid}`;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <CheckoutForm returnUrl={returnUrl} />
    </Elements>
  );
}
