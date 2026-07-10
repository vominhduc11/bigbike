import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { OrderConfirmView } from "./OrderConfirmView";
import { OrderConfirmClient } from "./OrderConfirmClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OrderConfirm");
  return buildPublicMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    canonicalPath: "/don-hang/xac-nhan/",
    noIndex: true,
  });
}

export default function OrderConfirmPage() {
  return (
    <Suspense fallback={<OrderConfirmView order={null} settingsRecord={{}} />}>
      <OrderConfirmClient />
    </Suspense>
  );
}
