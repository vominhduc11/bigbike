import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readSingleSearchParam } from "@/lib/utils/query";
import { toForgotPasswordPath } from "@/lib/utils/routes";
import ForgotPasswordFlow from "./ForgotPasswordFlow";

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ForgotPasswordPageProps): Promise<Metadata> {
  const params = await searchParams;
  const hasToken = Boolean(readSingleSearchParam(params.token));

  return buildPublicMetadata({
    title: hasToken ? "Dat lai mat khau" : "Quen mat khau",
    description: hasToken
      ? "Dat lai mat khau BigBike bang lien ket xac thuc."
      : "Gui yeu cau dat lai mat khau cho tai khoan BigBike.",
    canonicalPath: toForgotPasswordPath(),
    noIndex: true,
  });
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const token = readSingleSearchParam(params.token);

  return (
    <section className="bb-page">
      <div className="bb-container">
        <ForgotPasswordFlow token={token} />
      </div>
    </section>
  );
}
