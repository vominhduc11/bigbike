import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/locale";
import { Tr } from "@/components/i18n/Tr";
import { AuthBenefitsPanel, type AuthBrandPanel } from "@/components/auth/AuthPageFrame";
import { AuthRouteShell } from "@/components/auth/AuthRouteShell";
import { getTranslations } from "next-intl/server";

export default async function AuthLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const t = await getTranslations({ locale: localeParam, namespace: "Auth.brand" });
  const brandPanel: AuthBrandPanel = {
    eyebrow: <Tr ns="Auth.brand" k="eyebrow" />,
    title: <Tr ns="Auth.brand" k="title" />,
    description: <Tr ns="Auth.brand" k="description" />,
    benefits: [
      <Tr key="orders" ns="Auth.brand" k="benefitOrders" />,
      <Tr key="address" ns="Auth.brand" k="benefitAddress" />,
      <Tr key="offers" ns="Auth.brand" k="benefitOffers" />,
    ],
    imageAlt: t("imageAlt"),
  };

  return (
    <div data-auth-shell className="flex min-h-svh flex-1 flex-col bg-background">
      <main
        id="main-content"
        data-auth-main
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col bg-background"
      >
        <AuthRouteShell brandPanel={<AuthBenefitsPanel panel={brandPanel} />}>
          {children}
        </AuthRouteShell>
      </main>
    </div>
  );
}
