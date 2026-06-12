import { notFound } from "next/navigation";
import PaymentPage from "./PaymentPage";
import { getServerSideProps } from "./_getServerSideProps";

export default async function Page(componentProps: { params: Promise<{ uid: string }> }) {
  const params = await componentProps.params;
  const result = await getServerSideProps({ params });

  if ("notFound" in result && result.notFound) {
    return notFound();
  }

  const { props } = result as { props: Parameters<typeof PaymentPage>[0] };
  return <PaymentPage {...props} />;
}
