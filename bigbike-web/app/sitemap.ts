import type { MetadataRoute } from "next";
import {
  listArticles,
  listBrands,
  listCategories,
  listProducts,
} from "@/lib/api/public-api";
import {
  toArticlePath,
  toBrandPath,
  toCanonicalUrl,
  toCategoryPath,
  toHomePath,
  toProductPath,
} from "@/lib/utils/routes";

// Single-file sitemap suitable for the cutover catalog (< 50k URLs).
// If product/article counts grow past Google's 50k-per-file limit later,
// split via generateSitemaps() per the Next 16 docs.
const PAGE_SIZE = 1000;
const HARD_PAGE_LIMIT = 50;

async function fetchAll<T>(
  fetcher: (page: number) => Promise<{ data: T[]; pagination: { totalPages?: number } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= HARD_PAGE_LIMIT; page++) {
    const result = await fetcher(page);
    all.push(...result.data);
    const totalPages = result.pagination?.totalPages ?? 1;
    if (page >= totalPages || result.data.length === 0) break;
  }
  return all;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, brands, articles] = await Promise.all([
    fetchAll((page) =>
      listProducts({ page, size: PAGE_SIZE, sort: "createdAt:desc" }),
    ),
    fetchAll((page) =>
      listCategories({ page, size: PAGE_SIZE, sort: "sortOrder:asc" }),
    ),
    fetchAll((page) =>
      listBrands({ page, size: PAGE_SIZE, sort: "name:asc" }),
    ),
    fetchAll((page) =>
      listArticles({ page, size: PAGE_SIZE, sort: "publishedAt:desc" }),
    ),
  ]);

  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: toCanonicalUrl(toHomePath()),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  for (const p of products) {
    entries.push({
      url: toCanonicalUrl(toProductPath(p.slug)),
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const c of categories) {
    entries.push({
      url: toCanonicalUrl(toCategoryPath(c.slug)),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const b of brands) {
    entries.push({
      url: toCanonicalUrl(toBrandPath(b.slug)),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  for (const a of articles) {
    entries.push({
      url: toCanonicalUrl(toArticlePath(a.slug)),
      lastModified: a.publishedAt ? new Date(a.publishedAt) : now,
      changeFrequency: "monthly",
      priority: 0.4,
    });
  }

  return entries;
}
