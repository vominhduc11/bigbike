import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import type { WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";
import { WpStaticSidebarLayout } from "@/components/wp/WpStaticSidebarLayout";
import { getPageBySlug, getPublicMenu } from "@/lib/api/public-api";
import { safeText } from "@/lib/utils/format";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { toHomePath } from "@/lib/utils/routes";

const GUIDE_HERO_BG = "/wp-content/themes/bigbike/images/policy1.png";
const GUIDE_HERO_ILLUSTRATION = "/wp-content/themes/bigbike/images/policy.png";

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

/**
 * Sidebar .static-navigation cho nhóm Hướng dẫn — port từ menu theme_location
 * "guide" của page-guide.php. Khi menu chưa cấu hình, fall back về các route
 * hướng dẫn tĩnh đã biết để sidebar không rỗng.
 */
function buildGuideSidebar(
  menuItems: { id: string | number; url: string; label: string }[],
  currentPath: string,
  fallbackLabel: (route: GuideRoute) => string,
  menuFallback: string,
): WpStaticSidebarItem[] {
  if (menuItems.length > 0) {
    return menuItems.map((item) => {
      const href = normalizeMenuUrl(item.url);
      return {
        label: safeText(item.label, menuFallback),
        href,
        current: href === currentPath || href === `${currentPath}index.html`,
      };
    });
  }
  return Object.values(GUIDE_ROUTE_MAP).map((route) => ({
    label: fallbackLabel(route),
    href: route.path,
    current: route.path === currentPath,
  }));
}

export async function GuidePage({ subSegments }: GuidePageProps) {
  const [t, tBreadcrumb, locale] = await Promise.all([
    getTranslations("Guide"),
    getTranslations("Breadcrumb"),
    getLocale(),
  ]);
  const isRoot = !subSegments || subSegments.length === 0;
  const route = resolveGuideRoute(subSegments);
  const currentPath = route.path;

  const menuResult = await getPublicMenu("guide", locale);
  const menuItems = menuResult.data?.items ?? [];
  const sidebarItems = buildGuideSidebar(
    menuItems,
    currentPath,
    (r) => t(r.titleKey),
    t("menuFallback"),
  );

  // Root landing: CMS page "huong-dan" có thể không tồn tại → dựng lưới index các
  // bài hướng dẫn thay cho the_content, vẫn nằm trong khung WP + sidebar.
  if (isRoot) {
    return (
      <WpStaticShell
        title={t("heroTitle")}
        heroBgUrl={GUIDE_HERO_BG}
        heroIllustrationUrl={GUIDE_HERO_ILLUSTRATION}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("breadcrumb") },
        ]}
      >
        <WpStaticSidebarLayout sidebarItems={sidebarItems} sidebarEmptyLabel={t("emptyMenu")}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:gap-6">
            {Object.values(GUIDE_ROUTE_MAP).map((guide) => (
              <Link
                key={guide.pageSlug}
                href={guide.path}
                className="group block border border-neutral-200 bg-white p-6 no-underline transition-colors hover:border-neutral-900"
              >
                <h2 className="m-0 mb-2 text-lg font-semibold uppercase tracking-wide text-neutral-900">
                  {t(guide.titleKey)}
                </h2>
                <p className="m-0 text-sm leading-relaxed text-neutral-500">
                  {t(guide.descriptionKey)}
                </p>
              </Link>
            ))}
          </div>
        </WpStaticSidebarLayout>
      </WpStaticShell>
    );
  }

  const pageResult = await getPageBySlug(route.pageSlug, locale);
  // WP trả 404 khi page hướng dẫn không tồn tại.
  if (!pageResult.data) {
    notFound();
  }

  const page = pageResult.data;
  const pageTitle = safeText(page.title, t(route.titleKey));

  // page-guide.php: .page-title + #main-content > .container > .row
  // > [.col-md-3 sidebar] + [.col-md-9 > .static-page.wyswyg].
  return (
    <WpStaticShell
      title={page.heroTitle ?? pageTitle}
      heroBgUrl={page.heroImageUrl ?? GUIDE_HERO_BG}
      heroIllustrationUrl={GUIDE_HERO_ILLUSTRATION}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath() },
        { label: t("breadcrumb"), href: "/huong-dan/" },
        { label: pageTitle },
      ]}
    >
      <WpStaticSidebarLayout
        sidebarItems={sidebarItems}
        sidebarEmptyLabel={t("emptyMenu")}
        body={page.body}
      />
    </WpStaticShell>
  );
}
