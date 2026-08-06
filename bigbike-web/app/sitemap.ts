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

// Dựng theo TỪNG REQUEST, không prerender lúc build.
//
// Sitemap là dữ liệu sống: nó phải phản ánh catalog hiện tại, không phải ảnh chụp tại
// thời điểm build. Quan trọng hơn, `fetchAll` bên dưới ném lỗi khi API hỏng (thay vì
// xuất bản bản thiếu) — nếu route này còn prerender lúc build thì một lần backend
// chập chờn sẽ làm HỎNG CẢ BẢN BUILD, chặn luôn việc deploy những thay đổi không liên
// quan. Render theo request tách hai chuyện đó ra: build không cần backend, còn khi
// backend hỏng thì /sitemap.xml trả 5xx và Google giữ nguyên bản đã crawl lần trước.
// Tải thêm không đáng kể — Google chỉ lấy sitemap vài lần mỗi ngày.
export const dynamic = "force-dynamic";

// PHẢI ≤ 100: các endpoint catalog công khai validate `size` bằng @Min(1) @Max(100)
// (CatalogController#listProducts/listCategories/listBrands). Xin quá hạn mức thì
// backend trả 400, loadListWithQuery nuốt lỗi thành `data: []`, và sitemap lặng lẽ
// xuất bản thiếu toàn bộ sản phẩm/danh mục/thương hiệu/bài viết — đúng lỗi đã xảy ra
// trên production ngày 2026-08-06 (chỉ còn 24 URL tĩnh).
const PAGE_SIZE = 100;
// 100 × 50 = 5.000 URL mỗi loại, thừa sức cho quy mô hiện tại.
const HARD_PAGE_LIMIT = 50;
const STATIC_DATE = new Date("2025-01-01");

/**
 * KHÔNG được nuốt lỗi. `loadList` (lib/api/public-api.ts) biến mọi lỗi mạng/4xx/5xx
 * thành `{ data: [], pagination: null, error }` để trang thường còn render được phần
 * còn lại. Với sitemap thì ngược lại: một danh sách rỗng vì lỗi trông y hệt một danh
 * sách rỗng thật, nên Next vẫn xuất bản sitemap thiếu và Google gỡ hàng trăm URL.
 * Thà ném lỗi để /sitemap.xml trả 5xx — Google giữ nguyên bản đã crawl lần trước.
 */
class SitemapSourceError extends Error {
  constructor(source: string, page: number, cause: { message?: string } | null) {
    super(`Sitemap bỏ dở: nguồn "${source}" lỗi ở trang ${page} — ${cause?.message ?? "không rõ nguyên nhân"}`);
    this.name = "SitemapSourceError";
  }
}

async function fetchAll<T>(
  source: string,
  fetcher: (page: number) => Promise<{
    data: T[];
    pagination: { totalPages?: number } | null;
    error: { message?: string } | null;
  }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= HARD_PAGE_LIMIT; page++) {
    const result = await fetcher(page);
    if (result.error) {
      throw new SitemapSourceError(source, page, result.error);
    }
    all.push(...result.data);
    if (page >= (result.pagination?.totalPages ?? 1) || result.data.length === 0) break;
  }
  return all;
}

type EntryOptions = Omit<MetadataRoute.Sitemap[number], "url" | "alternates">;

/**
 * Trang tĩnh: hai bản luôn tồn tại và luôn khai hreflang cho nhau.
 */
function localePair(viPath: string, enPath: string, options: EntryOptions): MetadataRoute.Sitemap {
  return entryPair(viPath, enPath, options, true, true);
}

/**
 * Nội dung do admin quản lý — bản VI và bản EN **được cân nhắc độc lập**
 * (BUSINESS_RULES `SEO_RULE_001` + `SEO_RULE_002`):
 *
 * - Bản nào bị noindex thì không xuất hiện trong sitemap.
 * - `hreflang` chỉ khai khi **cả hai** bản đều được hiển thị. Khai một bản dịch mà mình
 *   vừa bảo Google đừng hiển thị là tín hiệu mâu thuẫn; và bản còn sống cũng không nên
 *   trỏ sang bản đã ẩn.
 */
function entryPair(
  viPath: string,
  enPath: string,
  options: EntryOptions,
  viIndexable: boolean,
  enIndexable: boolean,
): MetadataRoute.Sitemap {
  const viUrl = toCanonicalUrl(viPath);
  const enUrl = toCanonicalUrl(enPath);
  const alternates =
    viIndexable && enIndexable
      ? { languages: { vi: viUrl, en: enUrl, "x-default": viUrl } }
      : undefined;

  const entries: MetadataRoute.Sitemap = [];
  if (viIndexable) entries.push({ url: viUrl, ...(alternates ? { alternates } : {}), ...options });
  if (enIndexable) entries.push({ url: enUrl, ...(alternates ? { alternates } : {}), ...options });
  return entries;
}

/**
 * Backend resolve `seo.noIndex` **theo `lang` của request** (SeoIndexPolicy), nên phải đọc
 * danh sách hai lượt — `lang=vi` cho cờ bản Việt, `lang=en` cho cờ bản Anh (đã gộp sẵn ngưỡng
 * đủ nội dung EN) — rồi ghép theo `id`.
 *
 * Mục nào không có trong lượt EN (hiếm — ví dụ vừa bị ẩn giữa hai lần gọi) coi như không
 * hiển thị: thà thiếu một URL còn hơn khai nhầm một trang đang ẩn.
 */
function indexableBy<T extends { id?: string | null; seo?: { noIndex?: boolean | null } | null }>(
  rows: T[],
): (id: string | null | undefined) => boolean {
  const byId = new Map<string, boolean>();
  for (const row of rows) {
    if (row.id) byId.set(row.id, !row.seo?.noIndex);
  }
  return (id) => (id ? byId.get(id) ?? false : false);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, brands, articles, productsEn, categoriesEn, brandsEn, articlesEn] =
    await Promise.all([
      fetchAll("products", (page) => listProducts({ page, size: PAGE_SIZE, sort: "createdAt:desc", lang: "vi" })),
      fetchAll("categories", (page) => listCategories({ page, size: PAGE_SIZE, sort: "sortOrder:asc", lang: "vi" })),
      fetchAll("brands", (page) => listBrands({ page, size: PAGE_SIZE, sort: "name:asc", lang: "vi" })),
      fetchAll("articles", (page) => listArticles({ page, size: PAGE_SIZE, sort: "publishedAt:desc", lang: "vi" })),
      fetchAll("products:en", (page) => listProducts({ page, size: PAGE_SIZE, sort: "createdAt:desc", lang: "en" })),
      fetchAll("categories:en", (page) => listCategories({ page, size: PAGE_SIZE, sort: "sortOrder:asc", lang: "en" })),
      fetchAll("brands:en", (page) => listBrands({ page, size: PAGE_SIZE, sort: "name:asc", lang: "en" })),
      fetchAll("articles:en", (page) => listArticles({ page, size: PAGE_SIZE, sort: "publishedAt:desc", lang: "en" })),
    ]);

  const productEnIndexable = indexableBy(productsEn);
  const categoryEnIndexable = indexableBy(categoriesEn);
  const brandEnIndexable = indexableBy(brandsEn);
  const articleEnIndexable = indexableBy(articlesEn);

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
    entries.push(...entryPair(
      toProductPath(product.slug, "vi"),
      toProductPath(product.slugEn?.trim() || product.slug, "en"),
      { lastModified: product.updatedAt ? new Date(product.updatedAt) : STATIC_DATE, changeFrequency: "weekly", priority: 0.8 },
      !product.seo?.noIndex,
      productEnIndexable(product.id),
    ));
  }
  for (const category of categories) {
    entries.push(...entryPair(
      toCategoryPath(category.slug, "vi"),
      toCategoryPath(category.slugEn?.trim() || category.slug, "en"),
      { lastModified: category.updatedAt ? new Date(category.updatedAt) : STATIC_DATE, changeFrequency: "weekly", priority: 0.6 },
      !category.seo?.noIndex,
      categoryEnIndexable(category.id),
    ));
  }
  for (const brand of brands) {
    entries.push(...entryPair(
      toBrandPath(brand.slug, "vi"),
      toBrandPath(brand.slug, "en"),
      { lastModified: brand.updatedAt ? new Date(brand.updatedAt) : STATIC_DATE, changeFrequency: "monthly", priority: 0.5 },
      !brand.seo?.noIndex,
      brandEnIndexable(brand.id),
    ));
  }
  for (const article of articles) {
    entries.push(...entryPair(
      toArticlePath(article.slug, "vi"),
      toArticlePath(article.slugEn?.trim() || article.slug, "en"),
      { lastModified: article.updatedAt ? new Date(article.updatedAt) : STATIC_DATE, changeFrequency: "monthly", priority: 0.4 },
      !article.seo?.noIndex,
      articleEnIndexable(article.id),
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

