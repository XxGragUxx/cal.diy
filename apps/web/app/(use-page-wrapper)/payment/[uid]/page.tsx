import { withAppDirSsr } from "@calcom/app-store/_utils/withAppDirSsr";
import { notFound, redirect } from "next/navigation";
import PaymentPage from "./PaymentPage";
import { getServerSideProps } from "./_getServerSideProps";

const getData = withAppDirSsr(getServerSideProps);

export default async function Page({ params }: { params: { uid: string } }) {
  const result = await getData({ params });

  if ("notFound" in result && result.notFound) {
    return notFound();
  }

  if ("redirect" in result && result.redirect) {
    return redirect(result.redirect.destination);
  }

  const { props } = result as Awaited<ReturnType<typeof getServerSideProps>> & {
    props: NonNullable<unknown>;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PaymentPage {...(props as any)} />;
}
