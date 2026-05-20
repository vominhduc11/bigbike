import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/PageHero";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, getPublicMenu } from "@/lib/api/public-api";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath } from "@/lib/utils/routes";

type GuidePageProps = {
  subSegments?: string[];
};

type GuideRoute = {
  pageSlug: string;
  path: string;
  titleKey: string;
  descriptionKey: string;
};

const GUIDE_ROUTE_MAP: Record<string, GuideRoute> = {
  "mua-hang": {
    pageSlug: "huong-dan-mua-hang",
    path: "/huong-dan/mua-hang/",
    titleKey: "buyingTitle",
    descriptionKey: "buyingDescription",
  },
  "size-mu": {
    pageSlug: "cach-do-size-dau",
    path: "/huong-dan/size-mu/",
    titleKey: "helmetSizeTitle",
    descriptionKey: "helmetSizeDescription",
  },
  "size-gang-tay": {
    pageSlug: "cach-do-size-gang-tay",
    path: "/huong-dan/size-gang-tay/",
    titleKey: "gloveSizeTitle",
    descriptionKey: "gloveSizeDescription",
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
      titleKey: "title",
      descriptionKey: "description",
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
    titleKey: "title",
    descriptionKey: "description",
  };
}

export async function GuidePage({ subSegments }: GuidePageProps) {
  const [t, tBreadcrumb] = await Promise.all([
    getTranslations("Guide"),
    getTranslations("Breadcrumb"),
  ]);
  const isRoot = !subSegments || subSegments.length === 0;

  // Root landing: static index without CMS dependency (CMS page "huong-dan" may not exist)
  if (isRoot) {
    return (
      <section className="bb-page">
        <PageHero
          title={t("heroTitle")}
          breadcrumb={[
            { label: tBreadcrumb("home"), href: toHomePath() },
            { label: t("breadcrumb") },
          ]}
        />
        <div className="bb-container bb-section">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.values(GUIDE_ROUTE_MAP).map((guide) => (
              <Link
                key={guide.pageSlug}
                href={guide.path}
                className="group block bg-card border border-border p-6 no-underline text-inherit transition-colors duration-200 hover:border-brand"
              >
                <h2 className="font-display text-lg uppercase tracking-[0.02em] m-0 mb-2 leading-snug transition-colors duration-200 group-hover:text-brand">
                  {t(guide.titleKey)}
                </h2>
                <p className="text-sm text-muted-foreground m-0 leading-relaxed">{t(guide.descriptionKey)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const route = resolveGuideRoute(subSegments);
  const [pageResult, menuResult] = await Promise.all([
    getPageBySlug(route.pageSlug),
    getPublicMenu("guide"),
  ]);

  if (!pageResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={pageResult.error?.message ?? t("loadFailed")} />
        </div>
      </section>
    );
  }

  const page = pageResult.data;
  const currentPath = route.path;
  const menuItems = menuResult.data?.items ?? [];
  const pageTitle = safeText(page.title, t(route.titleKey));

  return (
    <section className="bb-page">
      <PageHero
        imageUrl={page.heroImageUrl}
        imageAlt={page.heroImageAlt}
        title={page.heroTitle ?? pageTitle}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("breadcrumb"), href: "/huong-dan/" },
          { label: pageTitle },
        ]}
      />
      <div className="bb-container">
        <div className="bb-detail-layout bb-section">
          <div className="bb-card bb-card-content">
            <article
              className="bb-richtext"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
            />
            <p className="bb-updated-date">{t("updatedAt", { date: formatDate(page.updatedAt) })}</p>
          </div>

          <aside className="bb-sidebar-grid">
            <div className="bb-card bb-card-content">
              <h2 className="bb-sidebar-heading">{t("sidebarTitle")}</h2>
              {menuResult.error ? (
                <p className="text-sm text-destructive px-2 py-1.5">{menuResult.error.message}</p>
              ) : menuItems.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("emptyMenu")}</p>
              ) : (
                <nav className="bb-nav-links">
                  {menuItems.map((item) => {
                    const href = normalizeMenuUrl(item.url);
                    const active = href === currentPath || href === `${currentPath}index.html`;
                    return (
                      <Link
                        key={item.id}
                        href={href}
                        className={active ? "bb-link font-bold text-brand" : "bb-link font-medium"}
                        aria-current={active ? "page" : undefined}
                      >
                        {safeText(item.label, t("menuFallback"))}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
