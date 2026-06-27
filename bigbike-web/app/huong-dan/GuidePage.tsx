import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getGuideLayout, getStaticPage, type StaticGuideEntry } from "@/lib/content/static-pages";
import { GuidePageClient } from "@/components/guide/GuidePageClient";

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

export async function GuidePage({ subSegments }: GuidePageProps) {
  const locale = await getLocale();
  const layout = getGuideLayout(locale);
  const entries = layout.entries;
  const isRoot = !subSegments || subSegments.length === 0;

  let page = null;
  if (!isRoot) {
    const entry = findEntry(entries, subSegments);
    if (!entry) {
      notFound();
    }
    page = getStaticPage(entry.pageSlug, locale);
    if (!page) {
      notFound();
    }
  }

  return (
    <GuidePageClient
      subSegments={subSegments}
      initialLayout={layout}
      initialEntries={entries}
      initialPage={page}
    />
  );
}


