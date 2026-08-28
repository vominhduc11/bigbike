import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "@/i18n/StorefrontLink";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { AuthPageFrame, AuthTitleBlock } from "@/components/auth/AuthPageFrame";
import { Tr } from "@/components/i18n/Tr";
import { LoginForm } from "./LoginForm";
import { LoginFormIsland } from "./LoginFormIsland";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locale";
import { toRegisterPath, translatePath } from "@/lib/utils/routes";

type LoginPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { locale } = (await params) as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return buildPublicMetadata({
    title: t("tabLogin"),
    description: t("loginMetaDescription"),
    canonicalPath: translatePath("/dang-nhap/", locale),
    locale,
    noIndex: true,
  });
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = (await params) as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Auth.brand" });
  return (
    <AuthPageFrame
      primary
      authPage="login"
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
      <AuthTitleBlock title={<Tr ns="Auth" k="tabLogin" />}>
        <p className="m-0 text-a4-content text-muted-foreground">
          <Tr ns="Auth.login" k="intro" />
          <span className="ml-1">
            <Tr ns="Auth.login" k="newMemberPrompt" />{" "}
            <Link href={toRegisterPath(locale)} className="font-semibold text-foreground underline">
              <Tr ns="Auth" k="here" />
            </Link>
          </span>
        </p>
      </AuthTitleBlock>
      <Suspense fallback={<LoginForm />}>
        <LoginFormIsland />
      </Suspense>
    </AuthPageFrame>
  );
}
