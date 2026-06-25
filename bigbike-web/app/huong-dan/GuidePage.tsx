import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  BookOpen, FileText, Hand, HardHat, HelpCircle, Info, Ruler, ShieldCheck, ShoppingCart, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import type { WpStaticSidebarItem } from "@/components/wp/WpStaticSidebar";
import { WpStaticSidebarLayout } from "@/components/wp/WpStaticSidebarLayout";
import { getGuideLayout, getStaticPage, type StaticGuideEntry } from "@/lib/content/static-pages";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath } from "@/lib/utils/routes";

/* eslint-disable @next/next/no-img-element */

const GUIDE_HERO_BG = "/wp-content/themes/bigbike/images/policy1.png";
const GUIDE_HERO_ILLUSTRATION = "/wp-content/themes/bigbike/images/policy.png";

// Lucide icons dùng cho ô hướng dẫn. `icon` có thể là đường dẫn ảnh (render <img>).
const ICONS: Record<string, LucideIcon> = {
  BookOpen, ShoppingCart, Ruler, Hand, HardHat, ShieldCheck, Wrench, Info, HelpCircle, FileText,
};

type GuidePageProps = {
  subSegments?: string[];
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

function buildSidebar(entries: StaticGuideEntry[], currentPath: string): WpStaticSidebarItem[] {
  return entries.map((e) => {
    const href = buildEntryPath(e.pathSegment);
    return { label: e.title, href, current: href === currentPath };
  });
}

function EntryIcon({ icon, label }: { icon: string | null; label: string }) {
  if (!icon) return null;
  if (icon.startsWith("/") || icon.startsWith("http")) {
    const src = resolveMediaUrl(icon) ?? icon;
    return <img src={src} alt={label} className="mb-3 h-10 w-10 object-contain" />;
  }
  const Lucide = ICONS[icon];
  return Lucide ? <Lucide size={32} className="mb-3 text-neutral-900" aria-hidden /> : null;
}

export async function GuidePage({ subSegments }: GuidePageProps) {
  const [t, tBreadcrumb, locale] = await Promise.all([
    getTranslations("Guide"),
    getTranslations("Breadcrumb"),
    getLocale(),
  ]);

  const layout = getGuideLayout(locale);
  const entries = layout.entries;
  const isRoot = !subSegments || subSegments.length === 0;

  const heroTitle = safeText(layout.heroTitle, t("heroTitle"));

  // ── Root landing: hero + grid of guide cards ────────────────────────────────
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
            <p className="text-ui-16 max-md:text-ui-14 text-neutral-500">{t("emptyMenu")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:gap-6">
              {entries.map((entry) => (
                <Link
                  key={entry.pathSegment}
                  href={buildEntryPath(entry.pathSegment)}
                  className="group block border border-neutral-200 bg-white p-6 no-underline transition-colors hover:border-neutral-900"
                >
                  <EntryIcon icon={entry.icon} label={entry.title} />
                  <h2 className="m-0 mb-2 text-h4 font-semibold uppercase tracking-wide text-neutral-900">
                    {entry.title}
                  </h2>
                  {entry.description ? (
                    <p className="m-0 text-ui-16 max-md:text-ui-14 leading-relaxed text-neutral-500">{entry.description}</p>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </WpStaticSidebarLayout>
      </WpStaticShell>
    );
  }

  // ── Sub-page: render nội dung tĩnh gắn với ô đã khớp ─────────────────────────
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
        bodyNode={
          <div
            className="static-page wyswyg"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
          />
        }
      />
    </WpStaticShell>
  );
}
