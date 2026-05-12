import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/PageHero";
import { PolicySidebar } from "@/components/layout/PolicySidebar";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath, toPagePath } from "@/lib/utils/routes";

export const metadata: Metadata = buildPublicMetadata({
  title: "Hướng dẫn mua hàng",
  description: "Hướng dẫn mua hàng BigBike — đặt hàng online, thanh toán COD, chuyển khoản.",
  canonicalPath: toPagePath("huong-dan-mua-hang"),
});

export default async function HowToBuyPage() {
  const pageResult = await getPageBySlug("huong-dan-mua-hang");

  if (!pageResult.data && pageResult.error?.status === 404) {
    notFound();
  }
  if (!pageResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={pageResult.error?.message ?? "Không tải được nội dung hướng dẫn mua hàng."} />
        </div>
      </section>
    );
  }

  const page = pageResult.data;
  const pageTitle = safeText(page.title, "Hướng dẫn mua hàng");

  return (
    <section className="bb-page">
      <PageHero
        imageUrl={page.heroImageUrl}
        imageAlt={page.heroImageAlt}
        kicker={page.heroKicker ?? "HƯỚNG DẪN"}
        title={page.heroTitle ?? pageTitle}
        description={page.heroDescription}
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: pageTitle },
        ]}
      />
      <div className="bb-container wp-static-layout">
        <PolicySidebar activeHref="/huong-dan-mua-hang" title="HƯỚNG DẪN" />
        <div className="wp-static-content">
          <article
            className="bb-richtext"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
          />
          <p className="wp-about-updated">Cập nhật {formatDate(page.updatedAt)}</p>
        </div>
      </div>
    </section>
  );
}
