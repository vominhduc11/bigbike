import Link from "@/i18n/StorefrontLink";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  BookOpen, FileText, Hand, HardHat, HelpCircle, Info, Ruler, ShieldCheck, ShoppingCart, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getGuideLayout, getStaticPage, type StaticGuideEntry } from "@/lib/content/static-pages";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { StaticSidebarLayout } from "@/components/layout/StaticSidebarLayout";
import type { PolicySidebarItem } from "@/components/layout/PolicySidebar";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import HelmetSizeTool from "@/components/guide/HelmetSizeTool";
import ClothingSizeTool from "@/components/guide/ClothingSizeTool";
import { HelmetSizeGuideContent } from "@/components/guide/HelmetSizeGuideContent";
import { ClothingSizeGuideContent } from "@/components/guide/ClothingSizeGuideContent";
import { RichContent } from "@/components/layout/RichContent";
import { MediaImage } from "@/components/ui/MediaImage";

type GuidePageProps = {
  subSegments?: string[];
  locale: Locale;
};

const GUIDE_HERO_BG = "/brand/guide/policy-bg.png";
const GUIDE_HERO_ILLUSTRATION = "/brand/guide/policy.png";

const ICONS: Record<string, LucideIcon> = {
  BookOpen, ShoppingCart, Ruler, Hand, HardHat, ShieldCheck, Wrench, Info, HelpCircle, FileText,
};

export function buildEntryPath(segment: string, locale: Locale): string {
  return translatePath(`/huong-dan/${encodeURIComponent(segment)}/`, locale);
}

function findEntry(entries: StaticGuideEntry[], subSegments?: string[]): StaticGuideEntry | null {
  if (!subSegments || subSegments.length === 0) return null;
  return entries.find((e) => e.pathSegment === subSegments[0]) ?? null;
}

/** Title/description cho {@code generateMetadata}; fallback về Guide translations. */
export async function resolveGuideMeta(subSegments: string[] | undefined, locale: Locale) {
  const t = await getTranslations({ locale, namespace: "Guide" });
  const layout = getGuideLayout(locale);
  const entry = findEntry(layout.entries, subSegments);
  if (entry) {
    return {
      title: entry.title,
      description: entry.description ?? t("description"),
      path: buildEntryPath(entry.pathSegment, locale),
    };
  }
  return { title: t("title"), description: t("description"), path: translatePath("/huong-dan/", locale) };
}

/**
 * Trang Hướng dẫn render sẵn cả 2 bản VI/EN rồi để client chọn theo locale
 * (AUD-013 — server luôn là `vi`, xem i18n/request.ts). Nội dung tĩnh trong code
 * nên nhánh EN không tốn thêm fetch nào.
 */
export async function GuidePage({ subSegments, locale }: GuidePageProps) {
  return renderGuideForLocale(locale, subSegments);
}

async function renderGuideForLocale(locale: Locale, subSegments?: string[]) {
  const [t, tBreadcrumb] = await Promise.all([
    getTranslations({ locale, namespace: "Guide" }),
    getTranslations({ locale, namespace: "Breadcrumb" }),
  ]);
  const layout = getGuideLayout(locale);
  const entries = layout.entries;
  const isRoot = !subSegments || subSegments.length === 0;
  const heroTitle = safeText(layout.heroTitle, t("heroTitle"));

  if (isRoot) {
    const sidebarItems = buildSidebar(entries, translatePath("/huong-dan/", locale), locale);
    return (
      <StaticPageShell
        title={heroTitle}
        heroBgUrl={GUIDE_HERO_BG}
        heroIllustrationUrl={GUIDE_HERO_ILLUSTRATION}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath(locale) },
          { label: t("breadcrumb") },
        ]}
      >
        <StaticSidebarLayout sidebarItems={sidebarItems} sidebarEmptyLabel={t("emptyMenu")}>
          {entries.length === 0 ? (
            <p className="text-a4-content text-muted-foreground">{t("emptyMenu")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:gap-6">
              {entries.map((entry) => (
                <Link
                  key={entry.pathSegment}
                  href={buildEntryPath(entry.pathSegment, locale)}
                  className="group block border border-border bg-white p-6 no-underline transition-colors hover:border-foreground"
                >
                  <EntryIcon icon={entry.icon} label={entry.title} />
                  <h2 className="m-0 mb-2 font-body text-a4-content font-semibold text-foreground">
                    {entry.title}
                  </h2>
                  {entry.description ? (
                    <p className="m-0 text-a4-content leading-relaxed text-muted-foreground">{entry.description}</p>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </StaticSidebarLayout>
      </StaticPageShell>
    );
  }

  const entry = findEntry(entries, subSegments);
  if (!entry) {
    notFound();
  }

  const page = getStaticPage(entry.pageSlug, locale);
  if (!page) {
    notFound();
  }

  const currentPath = buildEntryPath(entry.pathSegment, locale);
  const sidebarItems = buildSidebar(entries, currentPath, locale);
  const pageTitle = safeText(page.title, entry.title);

  let sizeTool: ReactNode = null;
  let customContentNode: ReactNode = null;
  if (entry.pathSegment === "size-mu") {
    sizeTool = <HelmetSizeTool locale={locale} />;
    customContentNode = <HelmetSizeGuideContent locale={locale} />;
  } else if (entry.pathSegment === "size-trang-phuc") {
    sizeTool = <ClothingSizeTool locale={locale} />;
    customContentNode = <ClothingSizeGuideContent locale={locale} />;
  }

  const bodyNode = (
    <div className="flex flex-col gap-8">
      {sizeTool}
      {customContentNode ?? (
        <RichContent
          html={sanitizeRichHtml(page.body, { allowInlineStyles: true, allowStyleTags: true, locale })}
        />
      )}
    </div>
  );

  return (
    <StaticPageShell
      title={page.heroTitle ?? pageTitle}
      heroBgUrl={GUIDE_HERO_BG}
      heroIllustrationUrl={GUIDE_HERO_ILLUSTRATION}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath(locale) },
        { label: t("breadcrumb"), href: translatePath("/huong-dan/", locale) },
        { label: pageTitle },
      ]}
    >
      <StaticSidebarLayout
        sidebarItems={sidebarItems}
        sidebarEmptyLabel={t("emptyMenu")}
        bodyNode={bodyNode}
      />
    </StaticPageShell>
  );
}

function buildSidebar(entries: StaticGuideEntry[], currentPath: string, locale: Locale): PolicySidebarItem[] {
  return entries.map((entry) => {
    const href = buildEntryPath(entry.pathSegment, locale);
    return { label: entry.title, href, current: href === currentPath };
  });
}

function EntryIcon({ icon, label }: { icon: string | null; label: string }) {
  if (!icon) return null;
  if (icon.startsWith("/") || icon.startsWith("http")) {
    const src = resolveMediaUrl(icon) ?? icon;
    return <MediaImage image={{ url: src, width: 40, height: 40 }} altFallback={label} sizes="40px" className="mb-3 h-10 w-10 object-contain" />;
  }
  const Lucide = ICONS[icon];
  return Lucide ? <Lucide size={32} className="mb-3 text-foreground" aria-hidden /> : null;
}
