import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, getPublicMenu } from "@/lib/api/public-api";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";

type GuidePageProps = {
  subSegments?: string[];
};

function normalizeMenuUrl(url: string): string {
  if (!url) {
    return "/";
  }
  return url.startsWith("/") ? url : `/${url}`;
}

function buildCurrentPath(subSegments?: string[]): string {
  if (!subSegments || subSegments.length === 0) {
    return "/huong-dan/";
  }
  return `/huong-dan/${subSegments.map((segment) => encodeURIComponent(segment)).join("/")}/`;
}

export async function GuidePage({ subSegments }: GuidePageProps) {
  const [pageResult, menuResult] = await Promise.all([
    getPageBySlug("huong-dan"),
    getPublicMenu("guide"),
  ]);

  if (!pageResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={pageResult.error?.message ?? "Không tải được nội dung hướng dẫn."} />
        </div>
      </section>
    );
  }

  const page = pageResult.data;
  const currentPath = buildCurrentPath(subSegments);
  const menuItems = menuResult.data?.items ?? [];

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <h1>{safeText(page.title, "Hướng dẫn")}</h1>
        </header>

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
                <nav style={{ display: "grid", gap: "var(--bb-space-2)" }}>
                  {menuItems.map((item) => {
                    const href = normalizeMenuUrl(item.url);
                    const active = href === currentPath || href === `${currentPath}index.html`;
                    return (
                      <Link
                        key={item.id}
                        href={href}
                        className="bb-link"
                        aria-current={active ? "page" : undefined}
                        style={{
                          fontWeight: active ? 700 : 500,
                          color: active ? "var(--bb-text-brand)" : undefined,
                        }}
                      >
                        {safeText(item.label, "Hướng dẫn")}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>

            {subSegments && subSegments.length > 0 ? (
              <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
                <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>Đường dẫn hiện tại</h2>
                <p style={{ color: "var(--bb-text-muted)" }}>{currentPath}</p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}
