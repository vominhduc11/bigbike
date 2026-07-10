import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  BookOpen, FileText, Hand, HardHat, HelpCircle, Info, Ruler, ShieldCheck, ShoppingCart, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getGuideLayout, getStaticPage, type StaticGuideEntry } from "@/lib/content/static-pages";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { WpStaticSidebarLayout } from "@/components/wp/WpStaticSidebarLayout";
import type { WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath } from "@/lib/utils/routes";
import HelmetSizeTool from "@/components/guide/HelmetSizeTool";
import ClothingSizeTool from "@/components/guide/ClothingSizeTool";
import { HelmetSizeGuideContent } from "@/components/guide/HelmetSizeGuideContent";
import { ClothingSizeGuideContent } from "@/components/guide/ClothingSizeGuideContent";

type GuidePageProps = {
  subSegments?: string[];
};

const GUIDE_HERO_BG = "/wp-content/themes/bigbike/images/policy1.png";
const GUIDE_HERO_ILLUSTRATION = "/wp-content/themes/bigbike/images/policy.png";

const ICONS: Record<string, LucideIcon> = {
  BookOpen, ShoppingCart, Ruler, Hand, HardHat, ShieldCheck, Wrench, Info, HelpCircle, FileText,
};

export function buildEntryPath(segment: string): string {
  return `/huong-dan/${encodeURIComponent(segment)}/`;
}

function findEntry(entries: StaticGuideEntry[], subSegments?: string[]): StaticGuideEntry | null {
  if (!subSegments || subSegments.length === 0) return null;
  return entries.find((e) => e.pathSegment === subSegments[0]) ?? null;
}

/** Title/description cho {@code generateMetadata}; fallback về Guide translations. */
export async function resolveGuideMeta(subSegments: string[] | undefined, locale: string) {
  const t = await getTranslations("Guide");
  const layout = getGuideLayout(locale);
  const entry = findEntry(layout.entries, subSegments);
  if (entry) {
    return {
      title: entry.title,
      description: entry.description ?? t("description"),
      path: buildEntryPath(entry.pathSegment),
    };
  }
  return { title: t("title"), description: t("description"), path: "/huong-dan/" };
}

export async function GuidePage({ subSegments }: GuidePageProps) {
  const [locale, t, tBreadcrumb] = await Promise.all([
    getLocale(),
    getTranslations("Guide"),
    getTranslations("Breadcrumb"),
  ]);
  const layout = getGuideLayout(locale);
  const entries = layout.entries;
  const isRoot = !subSegments || subSegments.length === 0;
  const heroTitle = safeText(layout.heroTitle, t("heroTitle"));

  if (isRoot) {
    const sidebarItems = buildSidebar(entries, "/huong-dan/");
    return (
      <WpStaticShell
        title={heroTitle}
        heroBgUrl={GUIDE_HERO_BG}
        heroIllustrationUrl={GUIDE_HERO_ILLUSTRATION}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("breadcrumb") },
        ]}
      >
        <WpStaticSidebarLayout sidebarItems={sidebarItems} sidebarEmptyLabel={t("emptyMenu")}>
          {entries.length === 0 ? (
            <p className="text-ui-16 max-md:text-ui-14 text-muted-foreground">{t("emptyMenu")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:gap-6">
              {entries.map((entry) => (
                <Link
                  key={entry.pathSegment}
                  href={buildEntryPath(entry.pathSegment)}
                  className="group block border border-border bg-white p-6 no-underline transition-colors hover:border-foreground"
                >
                  <EntryIcon icon={entry.icon} label={entry.title} />
                  <h2 className="m-0 mb-2 text-h4 font-semibold uppercase tracking-wide text-foreground">
                    {entry.title}
                  </h2>
                  {entry.description ? (
                    <p className="m-0 text-ui-16 max-md:text-ui-14 leading-relaxed text-muted-foreground">{entry.description}</p>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </WpStaticSidebarLayout>
      </WpStaticShell>
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

  const currentPath = buildEntryPath(entry.pathSegment);
  const sidebarItems = buildSidebar(entries, currentPath);
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
        <div
          className="static-page wyswyg"
          dangerouslySetInnerHTML={{
            __html: sanitizeRichHtml(page.body, { allowInlineStyles: true, allowStyleTags: true }),
          }}
        />
      )}
    </div>
  );

  return (
    <WpStaticShell
      title={page.heroTitle ?? pageTitle}
      heroBgUrl={GUIDE_HERO_BG}
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
        bodyNode={bodyNode}
      />
    </WpStaticShell>
  );
}

function buildSidebar(entries: StaticGuideEntry[], currentPath: string): WpStaticSidebarItem[] {
  return entries.map((entry) => {
    const href = buildEntryPath(entry.pathSegment);
    return { label: entry.title, href, current: href === currentPath };
  });
}

function EntryIcon({ icon, label }: { icon: string | null; label: string }) {
  if (!icon) return null;
  if (icon.startsWith("/") || icon.startsWith("http")) {
    const src = resolveMediaUrl(icon) ?? icon;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={label} className="mb-3 h-10 w-10 object-contain" />;
  }
  const Lucide = ICONS[icon];
  return Lucide ? <Lucide size={32} className="mb-3 text-foreground" aria-hidden /> : null;
}

