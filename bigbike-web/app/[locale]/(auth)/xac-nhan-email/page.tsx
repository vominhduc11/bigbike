import type { Metadata } from "next";
import { Suspense } from "react";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { AuthPageFrame } from "@/components/auth/AuthPageFrame";
import { VerifyEmailContent } from "./VerifyEmailContent";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locale";
import { translatePath } from "@/lib/utils/routes";

type VerifyEmailPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: VerifyEmailPageProps): Promise<Metadata> {
  const { locale } = (await params) as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return buildPublicMetadata({
    title: t("verifyMetaTitle"),
    description: t("verifyMetaDescription"),
    canonicalPath: translatePath("/xac-nhan-email/", locale),
    locale,
    noIndex: true,
  });
}

/**
 * Xác nhận email — nội dung client đọc token qua useSearchParams bên trong AuthLayout.
 */
export default async function VerifyEmailPage({ params }: VerifyEmailPageProps) {
  const { locale } = (await params) as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  return (
    <AuthPageFrame primary authPage="verify">
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </AuthPageFrame>
  );
}
