import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "@/i18n/StorefrontLink";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { AuthPageFrame, AuthTitleBlock } from "@/components/auth/AuthPageFrame";
import { Tr } from "@/components/i18n/Tr";
import { RegisterForm } from "./RegisterForm";
import { RegisterFormIsland } from "./RegisterFormIsland";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locale";
import { toLoginPath, translatePath } from "@/lib/utils/routes";

type RegisterPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: RegisterPageProps): Promise<Metadata> {
  const { locale } = (await params) as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return buildPublicMetadata({
    title: t("tabRegister"),
    description: t("registerMetaDescription"),
    canonicalPath: translatePath("/dang-ky/", locale),
    locale,
    noIndex: true,
  });
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { locale } = (await params) as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Auth.brand" });
  return (
    <AuthPageFrame
      wide
      primary
      authPage="register"
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
      <AuthTitleBlock title={<Tr ns="Auth" k="tabRegister" />} compact>
        <p className="sr-only">
          <Tr ns="Auth" k="haveAccountPrompt" />{" "}
          <Link
            href={toLoginPath(undefined, locale)}
            className="font-semibold text-foreground underline"
          >
            <Tr ns="Auth" k="here" />
          </Link>
          <br />
          <Tr ns="Auth" k="fillInfoPrompt" />
        </p>
      </AuthTitleBlock>
      <Suspense fallback={<RegisterForm />}>
        <RegisterFormIsland />
      </Suspense>
    </AuthPageFrame>
  );
}
