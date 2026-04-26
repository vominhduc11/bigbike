import type { MetadataRoute } from "next";
import {
  listArticles,
  listBrands,
  listCategories,
  listProducts,
} from "@/lib/api/public-api";
import {
  toArticleListPath,
  toArticlePath,
  toBrandListPath,
  toBrandPath,
  toCanonicalUrl,
  toCategoryPath,
  toHomePath,
  toPagePath,
  toProductListPath,
  toProductPath,
} from "@/lib/utils/routes";

// Single-file sitemap suitable for the cutover catalog (< 50k URLs).
// If product/article counts grow past Google's 50k-per-file limit later,
// split via generateSitemaps() per the Next 16 docs.
const PAGE_SIZE = 1000;
const HARD_PAGE_LIMIT = 50;

// Hardcoded last-modified dates for static pages to avoid redundant Googlebot recrawls.
const STATIC_PAGE_DATES = {
  home: new Date("2025-01-01"),
  about: new Date("2025-01-01"),
  guide: new Date("2025-01-01"),
  howToBuy: new Date("2025-01-01"),
  contact: new Date("2025-01-01"),
  productList: new Date("2025-01-01"),
  articleList: new Date("2025-01-01"),
  brandList: new Date("2025-01-01"),
  policy: new Date("2025-01-01"),
};

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

  const entries: MetadataRoute.Sitemap = [
    // ── Core pages ──────────────────────────────────────────
    {
      url: toCanonicalUrl(toHomePath()),
      lastModified: STATIC_PAGE_DATES.home,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: toCanonicalUrl(toProductListPath()),
      lastModified: STATIC_PAGE_DATES.productList,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: toCanonicalUrl(toArticleListPath()),
      lastModified: STATIC_PAGE_DATES.articleList,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: toCanonicalUrl(toBrandListPath()),
      lastModified: STATIC_PAGE_DATES.brandList,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // ── Static informational pages ───────────────────────────
    {
      url: toCanonicalUrl(toPagePath("gioi-thieu")),
      lastModified: STATIC_PAGE_DATES.about,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: toCanonicalUrl(toPagePath("huong-dan")),
      lastModified: STATIC_PAGE_DATES.guide,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: toCanonicalUrl(toPagePath("huong-dan-mua-hang")),
      lastModified: STATIC_PAGE_DATES.howToBuy,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: toCanonicalUrl(toPagePath("lien-he")),
      lastModified: STATIC_PAGE_DATES.contact,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    // ── Policy pages ─────────────────────────────────────────
    {
      url: toCanonicalUrl("/chinh-sach/bao-mat/"),
      lastModified: STATIC_PAGE_DATES.policy,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: toCanonicalUrl("/chinh-sach/bao-hanh/"),
      lastModified: STATIC_PAGE_DATES.policy,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: toCanonicalUrl("/chinh-sach/doi-tra/"),
      lastModified: STATIC_PAGE_DATES.policy,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: toCanonicalUrl("/chinh-sach/dieu-khoan/"),
      lastModified: STATIC_PAGE_DATES.policy,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  for (const p of products) {
    entries.push({
      url: toCanonicalUrl(toProductPath(p.slug)),
      lastModified: p.updatedAt ? new Date(p.updatedAt) : STATIC_PAGE_DATES.home,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const c of categories) {
    entries.push({
      url: toCanonicalUrl(toCategoryPath(c.slug)),
      lastModified: c.updatedAt ? new Date(c.updatedAt) : STATIC_PAGE_DATES.home,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const b of brands) {
    entries.push({
      url: toCanonicalUrl(toBrandPath(b.slug)),
      lastModified: b.updatedAt ? new Date(b.updatedAt) : STATIC_PAGE_DATES.home,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  for (const a of articles) {
    entries.push({
      url: toCanonicalUrl(toArticlePath(a.slug)),
      lastModified: a.publishedAt ? new Date(a.publishedAt) : STATIC_PAGE_DATES.home,
      changeFrequency: "monthly",
      priority: 0.4,
    });
  }

  return entries;
}
