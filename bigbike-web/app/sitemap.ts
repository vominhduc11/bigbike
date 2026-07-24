import type { MetadataRoute } from "next";
import {
  listArticles,
  listBrands,
  listCategories,
  listProducts,
} from "@/lib/api/public-api";
import { getGuideLayout } from "@/lib/content/static-pages";
import {
  toArticlePath,
  toBrandListPath,
  toBrandPath,
  toCanonicalUrl,
  toCategoryPath,
  toHomePath,
  toProductPath,
} from "@/lib/utils/routes";

// Trang thông tin ĐÃ ĐÓNG CỨNG (lib/content/static-pages) — không còn fetch backend.
// Chính sách phục vụ tại /chinh-sach/{slug-gốc} (khớp canonical của trang).
const POLICY_PAGE_SLUGS = [
  "chinh-sach-bao-mat-thong-tin",
  "chinh-sach-bao-hanh",
  "chinh-sach-doi-tra-hang",
];

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
  contact: new Date("2025-01-01"),
  productList: new Date("2025-01-01"),
  articleList: new Date("2025-01-01"),
  brandList: new Date("2025-01-01"),
  policy: new Date("2025-01-01"),
};

// Sản phẩm/Danh mục/Bài viết: khai cả URL VI (canonical) lẫn URL EN thật
// (/products|categories|news/{slugEn}/ — server-render riêng, xem
// app/products|categories|news/[slug]/page.tsx) khi bản ghi có `slugEn`. Bỏ qua
// hoàn toàn khi thiếu `slugEn` — không tạo link chết. Thương hiệu và các trang
// tĩnh khác không có URL EN riêng (BRAND_RULE_003) nên chỉ khai 1 URL VI.

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
    {
      url: toCanonicalUrl(toHomePath()),
      lastModified: STATIC_PAGE_DATES.home,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: toCanonicalUrl("/san-pham/"),
      lastModified: STATIC_PAGE_DATES.productList,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: toCanonicalUrl("/tin-tuc/"),
      lastModified: STATIC_PAGE_DATES.articleList,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: toCanonicalUrl("/gioi-thieu/"),
      lastModified: STATIC_PAGE_DATES.about,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: toCanonicalUrl("/huong-dan/"),
      lastModified: STATIC_PAGE_DATES.guide,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: toCanonicalUrl("/lien-he/"),
      lastModified: STATIC_PAGE_DATES.contact,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: toCanonicalUrl(toBrandListPath()),
      lastModified: STATIC_PAGE_DATES.brandList,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  for (const p of products) {
    entries.push({
      url: toCanonicalUrl(toProductPath(p.slug)),
      lastModified: p.updatedAt ? new Date(p.updatedAt) : STATIC_PAGE_DATES.home,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    if (p.slugEn) {
      entries.push({
        url: toCanonicalUrl(toProductPath(p.slugEn, "en", true)),
        lastModified: p.updatedAt ? new Date(p.updatedAt) : STATIC_PAGE_DATES.home,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  for (const c of categories) {
    entries.push({
      url: toCanonicalUrl(toCategoryPath(c.slug, "vi", false)),
      lastModified: c.updatedAt ? new Date(c.updatedAt) : STATIC_PAGE_DATES.home,
      changeFrequency: "weekly",
      priority: 0.6,
    });
    if (c.slugEn) {
      entries.push({
        url: toCanonicalUrl(toCategoryPath(c.slugEn, "en", true)),
        lastModified: c.updatedAt ? new Date(c.updatedAt) : STATIC_PAGE_DATES.home,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
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
    if (a.seo?.noIndex) continue;
    entries.push({
      url: toCanonicalUrl(toArticlePath(a.slug, "vi", false)),
      lastModified: a.updatedAt ? new Date(a.updatedAt) : STATIC_PAGE_DATES.home,
      changeFrequency: "monthly",
      priority: 0.4,
    });
    if (a.slugEn) {
      entries.push({
        url: toCanonicalUrl(toArticlePath(a.slugEn, "en", true)),
        lastModified: a.updatedAt ? new Date(a.updatedAt) : STATIC_PAGE_DATES.home,
        changeFrequency: "monthly",
        priority: 0.4,
      });
    }
  }

  // Trang chính sách tĩnh — đúng 3 trang (owner decision 2026-07-15, FIX_PROMPT §2 #6)
  for (const slug of POLICY_PAGE_SLUGS) {
    entries.push({
      url: toCanonicalUrl(`/chinh-sach/${slug}/`),
      lastModified: STATIC_PAGE_DATES.policy,
      changeFrequency: "yearly",
      priority: 0.3,
    });
  }

  // Trang con của Hướng dẫn (/huong-dan/{segment}/)
  for (const entry of getGuideLayout("vi").entries) {
    entries.push({
      url: toCanonicalUrl(`/huong-dan/${entry.pathSegment}/`),
      lastModified: STATIC_PAGE_DATES.guide,
      changeFrequency: "yearly",
      priority: 0.5,
    });
  }

  return entries;
}
