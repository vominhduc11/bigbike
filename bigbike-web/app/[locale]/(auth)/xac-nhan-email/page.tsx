import type { Metadata } from "next";
import { Suspense } from "react";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { AuthPageFrame } from "@/components/auth/AuthPageFrame";
import { Tr } from "@/components/i18n/Tr";
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
  const t = await getTranslations({ locale, namespace: "Auth.brand" });
  return (
    <AuthPageFrame
      primary
      authPage="verify"
      brandPanel={{
        eyebrow: <Tr ns="Auth.brand" k="eyebrow" />,
        title: <Tr ns="Auth.brand" k="title" />,
        description: <Tr ns="Auth.brand" k="description" />,
        benefits: [
          <Tr key="orders" ns="Auth.brand" k="benefitOrders" />,
          <Tr key="address" ns="Auth.brand" k="benefitAddress" />,
          <Tr key="offers" ns="Auth.brand" k="benefitOffers" />,
        ],
        imageAlt: t("imageAlt"),
      }}
    >
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </AuthPageFrame>
  );
}
