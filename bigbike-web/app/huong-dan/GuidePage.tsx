import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, getPublicMenu } from "@/lib/api/public-api";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";

type GuidePageProps = {
  subSegments?: string[];
};

type GuideRoute = {
  pageSlug: string;
  path: string;
  title: string;
  description: string;
};

const GUIDE_ROUTE_MAP: Record<string, GuideRoute> = {
  "mua-hang": {
    pageSlug: "huong-dan-mua-hang",
    path: "/huong-dan/mua-hang/",
    title: "Hướng dẫn mua hàng",
    description: "Hướng dẫn đặt hàng, thanh toán và nhận hàng tại BigBike.",
  },
  "size-mu": {
    pageSlug: "cach-do-size-dau",
    path: "/huong-dan/size-mu/",
    title: "Cách xác định size mũ bảo hiểm",
    description: "Hướng dẫn đo chu vi đầu và chọn size mũ bảo hiểm phù hợp.",
  },
  "size-gang-tay": {
    pageSlug: "cach-do-size-gang-tay",
    path: "/huong-dan/size-gang-tay/",
    title: "Cách đo size găng tay bảo hộ",
    description: "Hướng dẫn đo bàn tay và chọn size găng tay bảo hộ moto.",
  },
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

export function resolveGuideRoute(subSegments?: string[]): GuideRoute {
  if (!subSegments || subSegments.length === 0) {
    return {
      pageSlug: "huong-dan",
      path: "/huong-dan/",
      title: "Hướng dẫn",
      description: "Hướng dẫn mua hàng, sử dụng sản phẩm và dịch vụ từ BigBike.",
    };
  }

  if (subSegments.length === 1) {
    const mapped = GUIDE_ROUTE_MAP[subSegments[0]];
    if (mapped) {
      return mapped;
    }
  }

  return {
    pageSlug: "huong-dan",
    path: buildCurrentPath(subSegments),
    title: "Hướng dẫn",
    description: "Hướng dẫn mua hàng, sử dụng sản phẩm và dịch vụ từ BigBike.",
  };
}

export async function GuidePage({ subSegments }: GuidePageProps) {
  const route = resolveGuideRoute(subSegments);
  const [pageResult, menuResult] = await Promise.all([
    getPageBySlug(route.pageSlug),
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
  const currentPath = route.path;
  const menuItems = menuResult.data?.items ?? [];

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <h1>{safeText(page.title, "Hướng dẫn")}</h1>
        </header>

        <div className="bb-detail-layout bb-section">
          <div className="bb-card bb-card-content">
            <article
              className="bb-richtext"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
            />
            <p className="bb-updated-date">Cập nhật {formatDate(page.updatedAt)}</p>
          </div>

          <aside className="bb-sidebar-grid">
            <div className="bb-card bb-card-content">
              <h2 className="bb-sidebar-heading">Mục hướng dẫn</h2>
              {menuResult.error ? (
                <p className="bb-status-banner">{menuResult.error.message}</p>
              ) : menuItems.length === 0 ? (
                <p className="wp-muted-text">Chưa có mục hướng dẫn.</p>
              ) : (
                <nav className="bb-nav-links">
                  {menuItems.map((item) => {
                    const href = normalizeMenuUrl(item.url);
                    const active = href === currentPath || href === `${currentPath}index.html`;
                    return (
                      <Link
                        key={item.id}
                        href={href}
                        className="bb-link"
                        aria-current={active ? "page" : undefined}
                        style={{ fontWeight: active ? 700 : 500, color: active ? "var(--bb-text-brand)" : undefined }}
                      >
                        {safeText(item.label, "Hướng dẫn")}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>

            {subSegments && subSegments.length > 0 ? (
              <div className="bb-card bb-card-content">
                <h2 className="bb-sidebar-heading">Đường dẫn hiện tại</h2>
                <p className="wp-muted-text">{currentPath}</p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}
