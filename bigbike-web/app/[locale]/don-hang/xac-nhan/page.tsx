import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { OrderConfirmView } from "./OrderConfirmView";
import { OrderConfirmClient } from "./OrderConfirmClient";
import { translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

type OrderConfirmPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: OrderConfirmPageProps): Promise<Metadata> {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("OrderConfirm");
  return buildPublicMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    canonicalPath: translatePath("/don-hang/xac-nhan/", locale),
    locale,
    noIndex: true,
  });
}

export default async function OrderConfirmPage({ params }: OrderConfirmPageProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  return (
    <Suspense fallback={<OrderConfirmView order={null} settingsRecord={{}} />}>
      <OrderConfirmClient />
    </Suspense>
  );
}
