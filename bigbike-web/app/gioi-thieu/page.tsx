import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/PageHero";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath, toPagePath } from "@/lib/utils/routes";

export const metadata: Metadata = buildPublicMetadata({
  title: "Giới thiệu",
  description: "Giới thiệu BigBike — hệ thống đồ bảo hộ biker, gear touring chính hãng.",
  canonicalPath: toPagePath("gioi-thieu"),
});

export default async function AboutPage() {
  const result = await getPageBySlug("gioi-thieu");
  if (!result.data && result.error?.status === 404) {
    notFound();
  }
  if (!result.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={result.error?.message ?? "Không tải được nội dung giới thiệu."} />
        </div>
      </section>
    );
  }

  const page = result.data;
  const pageTitle = safeText(page.title, "Giới thiệu");

  return (
    <section className="bb-page">
      <PageHero
        imageUrl={page.heroImageUrl}
        imageAlt={page.heroImageAlt}
        kicker={page.heroKicker ?? "GIỚI THIỆU"}
        title={page.heroTitle ?? pageTitle}
        description={page.heroDescription}
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: pageTitle },
        ]}
      />
      <div className="bb-container">
        <article
          className="bb-richtext bb-section"
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
        />
        <p style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-xs)", marginTop: "var(--bb-space-4)" }}>
          Cập nhật {formatDate(page.updatedAt)}
        </p>
      </div>
    </section>
  );
}
