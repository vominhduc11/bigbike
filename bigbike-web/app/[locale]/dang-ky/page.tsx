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
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return buildPublicMetadata({ title: t("tabRegister"), description: t("registerMetaDescription"), canonicalPath: translatePath("/dang-ky/", locale), locale, noIndex: true });
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  return (
    <AuthPageFrame wide>
      <AuthTitleBlock title={<Tr ns="Auth" k="tabRegister" />}>
        <p className="m-0 text-a4-content text-foreground">
          <Tr ns="Auth" k="haveAccountPrompt" />{" "}
          <Link href={toLoginPath(undefined, locale)} className="font-semibold text-foreground underline">
            <Tr ns="Auth" k="here" />
          </Link>
        </p>
        <p className="m-0 mt-1 text-a4-content text-foreground"><Tr ns="Auth" k="fillInfoPrompt" /></p>
      </AuthTitleBlock>
      <Suspense fallback={<RegisterForm />}>
        <RegisterFormIsland />
      </Suspense>
    </AuthPageFrame>
  );
}
