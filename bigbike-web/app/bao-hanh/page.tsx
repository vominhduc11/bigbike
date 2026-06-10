import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toHomePath } from "@/lib/utils/routes";
import { WarrantyContent } from "./WarrantyContent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Warranty");
  return buildPublicMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    canonicalPath: "/bao-hanh/",
    noIndex: false,
  });
}

export default async function WarrantyLookupPage() {
  const [t, tBreadcrumb] = await Promise.all([
    getTranslations("Warranty"),
    getTranslations("Breadcrumb"),
  ]);

  // Khung WP page.php: banner + breadcrumb; bên trong là công cụ tra cứu bảo hành
  // (tự mang Container riêng nên đặt thẳng trong #main-content).
  return (
    <WpStaticShell
      title={t("heading")}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath() },
        { label: t("heading") },
      ]}
    >
      <WarrantyContent />
    </WpStaticShell>
  );
}
