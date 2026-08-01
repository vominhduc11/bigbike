import type { MetadataRoute } from "next";

import { listArticles, listBrands, listCategories, listProducts } from "@/lib/api/public-api";
import { getGuideLayout } from "@/lib/content/static-pages";
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
  translatePath,
} from "@/lib/utils/routes";

const PAGE_SIZE = 1000;
const HARD_PAGE_LIMIT = 50;
const STATIC_DATE = new Date("2025-01-01");

async function fetchAll<T>(
  fetcher: (page: number) => Promise<{ data: T[]; pagination: { totalPages?: number } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= HARD_PAGE_LIMIT; page++) {
    const result = await fetcher(page);
    all.push(...result.data);
    if (page >= (result.pagination?.totalPages ?? 1) || result.data.length === 0) break;
  }
  return all;
}

type EntryOptions = Omit<MetadataRoute.Sitemap[number], "url" | "alternates">;

function localePair(viPath: string, enPath: string, options: EntryOptions): MetadataRoute.Sitemap {
  const viUrl = toCanonicalUrl(viPath);
  const enUrl = toCanonicalUrl(enPath);
  const alternates = { languages: { vi: viUrl, en: enUrl, "x-default": viUrl } };
  return [
    { url: viUrl, alternates, ...options },
    { url: enUrl, alternates, ...options },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, brands, articles] = await Promise.all([
    fetchAll((page) => listProducts({ page, size: PAGE_SIZE, sort: "createdAt:desc", lang: "vi" })),
    fetchAll((page) => listCategories({ page, size: PAGE_SIZE, sort: "sortOrder:asc", lang: "vi" })),
    fetchAll((page) => listBrands({ page, size: PAGE_SIZE, sort: "name:asc", lang: "vi" })),
    fetchAll((page) => listArticles({ page, size: PAGE_SIZE, sort: "publishedAt:desc", lang: "vi" })),
  ]);

  const entries: MetadataRoute.Sitemap = [
    ...localePair(toHomePath("vi"), toHomePath("en"), { lastModified: STATIC_DATE, changeFrequency: "daily", priority: 1 }),
    ...localePair(toProductListPath("vi"), toProductListPath("en"), { lastModified: STATIC_DATE, changeFrequency: "daily", priority: 0.9 }),
    ...localePair(toArticleListPath("vi"), toArticleListPath("en"), { lastModified: STATIC_DATE, changeFrequency: "weekly", priority: 0.7 }),
    ...localePair(toBrandListPath("vi"), toBrandListPath("en"), { lastModified: STATIC_DATE, changeFrequency: "monthly", priority: 0.5 }),
    ...localePair(toPagePath("gioi-thieu", "vi"), toPagePath("gioi-thieu", "en"), { lastModified: STATIC_DATE, changeFrequency: "yearly", priority: 0.5 }),
    ...localePair(toPagePath("lien-he", "vi"), toPagePath("lien-he", "en"), { lastModified: STATIC_DATE, changeFrequency: "yearly", priority: 0.5 }),
    ...localePair(translatePath("/huong-dan/", "vi"), translatePath("/huong-dan/", "en"), { lastModified: STATIC_DATE, changeFrequency: "yearly", priority: 0.5 }),
  ];

  for (const product of products) {
    entries.push(...localePair(
      toProductPath(product.slug, "vi"),
      toProductPath(product.slugEn?.trim() || product.slug, "en"),
      { lastModified: product.updatedAt ? new Date(product.updatedAt) : STATIC_DATE, changeFrequency: "weekly", priority: 0.8 },
    ));
  }
  for (const category of categories) {
    entries.push(...localePair(
      toCategoryPath(category.slug, "vi"),
      toCategoryPath(category.slugEn?.trim() || category.slug, "en"),
      { lastModified: category.updatedAt ? new Date(category.updatedAt) : STATIC_DATE, changeFrequency: "weekly", priority: 0.6 },
    ));
  }
  for (const brand of brands) {
    entries.push(...localePair(
      toBrandPath(brand.slug, "vi"),
      toBrandPath(brand.slug, "en"),
      { lastModified: brand.updatedAt ? new Date(brand.updatedAt) : STATIC_DATE, changeFrequency: "monthly", priority: 0.5 },
    ));
  }
  for (const article of articles) {
    if (article.seo?.noIndex) continue;
    entries.push(...localePair(
      toArticlePath(article.slug, "vi"),
      toArticlePath(article.slugEn?.trim() || article.slug, "en"),
      { lastModified: article.updatedAt ? new Date(article.updatedAt) : STATIC_DATE, changeFrequency: "monthly", priority: 0.4 },
    ));
  }

  for (const slug of ["chinh-sach-bao-mat-thong-tin", "chinh-sach-bao-hanh", "chinh-sach-doi-tra-hang"]) {
    const source = `/chinh-sach/${slug}/`;
    entries.push(...localePair(translatePath(source, "vi"), translatePath(source, "en"), { lastModified: STATIC_DATE, changeFrequency: "yearly", priority: 0.3 }));
  }
  for (const guide of getGuideLayout("vi").entries) {
    const source = `/huong-dan/${guide.pathSegment}/`;
    entries.push(...localePair(translatePath(source, "vi"), translatePath(source, "en"), { lastModified: STATIC_DATE, changeFrequency: "yearly", priority: 0.5 }));
  }

  return entries;
}

