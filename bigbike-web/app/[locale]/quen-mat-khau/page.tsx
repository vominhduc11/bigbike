import type { Metadata } from "next";
import { Suspense } from "react";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toForgotPasswordPath } from "@/lib/utils/routes";
import { AuthPageFrame } from "@/components/auth/AuthPageFrame";
import ForgotPasswordFlow from "./ForgotPasswordFlow";
import { ForgotPasswordFlowIsland } from "./ForgotPasswordFlowIsland";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locale";

type ForgotPasswordPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ForgotPasswordPageProps): Promise<Metadata> {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return buildPublicMetadata({ title: t("forgot.title"), description: t("forgotMetaDescription"), canonicalPath: toForgotPasswordPath(undefined, locale), locale, noIndex: true });
}

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  return (
    <AuthPageFrame>
      <Suspense fallback={<ForgotPasswordFlow />}>
        <ForgotPasswordFlowIsland />
      </Suspense>
    </AuthPageFrame>
  );
}
