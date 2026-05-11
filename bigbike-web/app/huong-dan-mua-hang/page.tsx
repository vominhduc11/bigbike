import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/PageHero";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, getPublicMenu } from "@/lib/api/public-api";
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
  const [pageResult, menuResult] = await Promise.all([
    getPageBySlug("huong-dan-mua-hang"),
    getPublicMenu("guide"),
  ]);

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
  const menuItems = menuResult.data?.items ?? [];
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
          { label: "Hướng dẫn", href: "/huong-dan/" },
          { label: pageTitle },
        ]}
      />
      <div className="bb-container">
        <div className="bb-detail-layout bb-section">
          <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
            <article
              className="bb-richtext"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
            />
            <p style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-xs)", marginTop: "var(--bb-space-4)" }}>
              Cập nhật {formatDate(page.updatedAt)}
            </p>
          </div>

          <aside style={{ display: "grid", gap: "var(--bb-space-4)" }}>
            <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
              <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>Mục hướng dẫn</h2>
              {menuResult.error ? (
                <p className="bb-status-banner">{menuResult.error.message}</p>
              ) : menuItems.length === 0 ? (
                <p style={{ color: "var(--bb-text-muted)" }}>Chưa có mục hướng dẫn.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: "var(--bb-space-5)" }}>
                  {menuItems.map((item) => (
                    <li key={item.id}>
                      <span>{safeText(item.label, "Hướng dẫn")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
