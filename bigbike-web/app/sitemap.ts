import type { MetadataRoute } from "next";
import {
  listArticles,
  listBrands,
  listCategories,
  listProducts,
} from "@/lib/api/public-api";
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
} from "@/lib/utils/routes";

// Trang thông tin ĐÃ ĐÓNG CỨNG (lib/content/static-pages) — không còn fetch backend.
// Chính sách phục vụ tại /chinh-sach/{slug-gốc} (khớp menu "policy" + canonical của trang).
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
      alternates: {
        languages: {
          vi: toCanonicalUrl("/"),
          en: toCanonicalUrl("/"),
        },
      },
    },
  ];

  // Static routes with VI <-> EN mapping
  const staticRoutes = [
    {
      vi: "/san-pham/",
      en: "/products/",
      lastModified: STATIC_PAGE_DATES.productList,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      vi: "/tin-tuc/",
      en: "/news/",
      lastModified: STATIC_PAGE_DATES.articleList,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    {
      vi: "/gioi-thieu/",
      en: "/about/",
      lastModified: STATIC_PAGE_DATES.about,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    },
    {
      vi: "/huong-dan/",
      en: "/guide/",
      lastModified: STATIC_PAGE_DATES.guide,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    },
    {
      vi: "/lien-he/",
      en: "/contact/",
      lastModified: STATIC_PAGE_DATES.contact,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    },
  ];

  for (const route of staticRoutes) {
    const viUrl = toCanonicalUrl(route.vi);
    const enUrl = toCanonicalUrl(route.en);
    entries.push(
      {
        url: viUrl,
        lastModified: route.lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: {
            vi: viUrl,
            en: enUrl,
          },
        },
      },
      {
        url: enUrl,
        lastModified: route.lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: {
            vi: viUrl,
            en: enUrl,
          },
        },
      }
    );
  }

  // Brands list has no EN-specific URL path mapping
  const brandListUrl = toCanonicalUrl(toBrandListPath());
  entries.push({
    url: brandListUrl,
    lastModified: STATIC_PAGE_DATES.brandList,
    changeFrequency: "monthly",
    priority: 0.5,
    alternates: {
      languages: {
        vi: brandListUrl,
        en: brandListUrl,
      },
    },
  });

  for (const p of products) {
    const viUrl = toCanonicalUrl(toProductPath(p.slug));
    const enUrl = p.slugEn ? toCanonicalUrl(toProductPath(p.slugEn)) : null;
    const lastMod = p.updatedAt ? new Date(p.updatedAt) : STATIC_PAGE_DATES.home;

    entries.push({
      url: viUrl,
      lastModified: lastMod,
      changeFrequency: "weekly",
      priority: 0.8,
      ...(enUrl ? { alternates: { languages: { vi: viUrl, en: enUrl } } } : {}),
    });

    if (enUrl) {
      entries.push({
        url: enUrl,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: {
          languages: {
            vi: viUrl,
            en: enUrl,
          },
        },
      });
    }
  }

  for (const c of categories) {
    const viUrl = toCanonicalUrl(toCategoryPath(c.slug, "vi", false));
    const enUrl = c.slugEn ? toCanonicalUrl(toCategoryPath(c.slugEn, "en", true)) : null;
    const lastMod = c.updatedAt ? new Date(c.updatedAt) : STATIC_PAGE_DATES.home;

    entries.push({
      url: viUrl,
      lastModified: lastMod,
      changeFrequency: "weekly",
      priority: 0.6,
      ...(enUrl ? { alternates: { languages: { vi: viUrl, en: enUrl } } } : {}),
    });

    if (enUrl) {
      entries.push({
        url: enUrl,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: {
          languages: {
            vi: viUrl,
            en: enUrl,
          },
        },
      });
    }
  }

  for (const b of brands) {
    const viUrl = toCanonicalUrl(toBrandPath(b.slug));
    const enUrl = b.slugEn ? toCanonicalUrl(toBrandPath(b.slugEn)) : null;
    const lastMod = b.updatedAt ? new Date(b.updatedAt) : STATIC_PAGE_DATES.home;

    entries.push({
      url: viUrl,
      lastModified: lastMod,
      changeFrequency: "monthly",
      priority: 0.5,
      ...(enUrl ? { alternates: { languages: { vi: viUrl, en: enUrl } } } : {}),
    });

    if (enUrl) {
      entries.push({
        url: enUrl,
        lastModified: lastMod,
        changeFrequency: "monthly",
        priority: 0.5,
        alternates: {
          languages: {
            vi: viUrl,
            en: enUrl,
          },
        },
      });
    }
  }

  for (const a of articles) {
    if (a.seo?.noIndex) continue;
    const viUrl = toCanonicalUrl(toArticlePath(a.slug, "vi", false));
    const enUrl = a.slugEn ? toCanonicalUrl(toArticlePath(a.slugEn, "en", true)) : null;
    const lastMod = a.updatedAt ? new Date(a.updatedAt) : STATIC_PAGE_DATES.home;

    entries.push({
      url: viUrl,
      lastModified: lastMod,
      changeFrequency: "monthly",
      priority: 0.4,
      ...(enUrl ? { alternates: { languages: { vi: viUrl, en: enUrl } } } : {}),
    });

    if (enUrl) {
      entries.push({
        url: enUrl,
        lastModified: lastMod,
        changeFrequency: "monthly",
        priority: 0.4,
        alternates: {
          languages: {
            vi: viUrl,
            en: enUrl,
          },
        },
      });
    }
  }

  // Trang chính sách tĩnh (/chinh-sach/{slug-gốc} ↔ /policy/{slug-gốc})
  for (const slug of POLICY_PAGE_SLUGS) {
    const viUrl = toCanonicalUrl(`/chinh-sach/${slug}/`);
    const enUrl = toCanonicalUrl(`/policy/${slug}/`);
    entries.push(
      {
        url: viUrl,
        lastModified: STATIC_PAGE_DATES.policy,
        changeFrequency: "yearly",
        priority: 0.3,
        alternates: {
          languages: {
            vi: viUrl,
            en: enUrl,
          },
        },
      },
      {
        url: enUrl,
        lastModified: STATIC_PAGE_DATES.policy,
        changeFrequency: "yearly",
        priority: 0.3,
        alternates: {
          languages: {
            vi: viUrl,
            en: enUrl,
          },
        },
      }
    );
  }

  // Trang con của Hướng dẫn (/huong-dan/{segment}/ ↔ /guide/{segment}/)
  for (const entry of getGuideLayout("vi").entries) {
    const viUrl = toCanonicalUrl(`/huong-dan/${entry.pathSegment}/`);
    const enUrl = toCanonicalUrl(`/guide/${entry.pathSegment}/`);
    entries.push(
      {
        url: viUrl,
        lastModified: STATIC_PAGE_DATES.guide,
        changeFrequency: "yearly",
        priority: 0.5,
        alternates: {
          languages: {
            vi: viUrl,
            en: enUrl,
          },
        },
      },
      {
        url: enUrl,
        lastModified: STATIC_PAGE_DATES.guide,
        changeFrequency: "yearly",
        priority: 0.5,
        alternates: {
          languages: {
            vi: viUrl,
            en: enUrl,
          },
        },
      }
    );
  }

  return entries;
}
