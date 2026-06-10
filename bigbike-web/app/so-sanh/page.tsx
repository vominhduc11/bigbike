import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toComparePath, toHomePath } from "@/lib/utils/routes";
import { CompareClient } from "./CompareClient";

// The comparison list lives in the visitor's browser (localStorage), so the
// page has no stable indexable content — keep it out of search results.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Compare");
  return buildPublicMetadata({
    title: t("title"),
    description: t("metaDescription"),
    canonicalPath: toComparePath(),
    noIndex: true,
  });
}

// Trang MỚI (WP gốc không có) nhưng dùng đúng khung WP — WpStaticShell render
// WpHeader/WpFooter + .page-title (hero + breadcrumb) như các trang nội dung khác.
// Bảng so sánh (đọc localStorage qua useCompare) do <CompareClient/> render bên trong.
export default async function ComparePage() {
  const t = await getTranslations("Compare");
  const heading = t("heading");
  return (
    <WpStaticShell
      title={heading}
      breadcrumb={[
        { label: "Bigbike.vn", href: toHomePath() },
        { label: heading },
      ]}
    >
      <div className="container">
        <CompareClient />
      </div>
    </WpStaticShell>
  );
}
