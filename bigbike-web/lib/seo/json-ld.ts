import type { Article, Brand, Category, Product } from "@/lib/contracts/public";
import {
  toArticleListPath,
  toArticlePath,
  toBrandListPath,
  toBrandPath,
  toCanonicalUrl,
  toCategoryPath,
  toHomePath,
  toProductListPath,
  toProductPath,
} from "@/lib/utils/routes";

type JsonLdObject = Record<string, unknown>;

const SITE_NAME = "BigBike";
const ORG_LOGO_PATH = "/brand/logo/PNG/01/BIGBIKE_FINAL_LOGO-01.png";

function buildPublisher(): JsonLdObject {
  return {
    "@type": "Organization",
    name: SITE_NAME,
    logo: {
      "@type": "ImageObject",
      url: toCanonicalUrl(ORG_LOGO_PATH),
    },
  };
}

export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function buildProductJsonLd(product: Product): JsonLdObject {
  const canonicalUrl = toCanonicalUrl(product.seo?.canonicalUrl ?? toProductPath(product.slug));
  const images = collectProductImages(product);
  const priceCurrency = product.price?.currency ?? "VND";
  const offers = buildProductOffers(product, canonicalUrl, priceCurrency);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seo?.description ?? product.shortDescription ?? product.description ?? "",
    sku: product.sku ?? undefined,
    image: images.length > 0 ? images : undefined,
    brand: product.brand?.name
      ? {
          "@type": "Brand",
          name: product.brand.name,
        }
      : undefined,
    category: product.category?.name ?? undefined,
    url: canonicalUrl,
    offers,
  };
}

export function buildArticleJsonLd(article: Article): JsonLdObject {
  const canonicalUrl = toCanonicalUrl(article.seo?.canonicalUrl ?? toArticlePath(article.slug));
  const images = article.coverImage?.url ? [article.coverImage.url] : [];

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.excerpt ?? "",
    image: images.length > 0 ? images : undefined,
    author: article.author?.name
      ? {
          "@type": "Person",
          name: article.author.name,
        }
      : undefined,
    articleSection: article.category?.name ?? undefined,
    datePublished: article.publishedAt ?? article.createdAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    publisher: buildPublisher(),
  };
}

export function buildBreadcrumbJsonLd(product: Product): JsonLdObject {
  const items: Array<{ position: number; name: string; item: string }> = [
    {
      position: 1,
      name: "Trang chu",
      item: toCanonicalUrl(toHomePath()),
    },
  ];

  if (product.category?.name && product.category.slug) {
    items.push({
      position: items.length + 1,
      name: product.category.name,
      item: toCanonicalUrl(toCategoryPath(product.category.slug)),
    });
  }

  items.push({
    position: items.length + 1,
    name: product.name,
    item: toCanonicalUrl(toProductPath(product.slug)),
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item) => ({
      "@type": "ListItem",
      ...item,
    })),
  };
}

export function buildArticleBreadcrumbJsonLd(article: Article): JsonLdObject {
  const items: Array<{ position: number; name: string; item: string }> = [
    {
      position: 1,
      name: "Trang chu",
      item: toCanonicalUrl(toHomePath()),
    },
    {
      position: 2,
      name: "Tin tức",
      item: toCanonicalUrl(toArticleListPath()),
    },
  ];

  items.push({
    position: items.length + 1,
    name: article.title,
    item: toCanonicalUrl(toArticlePath(article.slug)),
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item) => ({
      "@type": "ListItem",
      ...item,
    })),
  };
}

export function buildCategoryBreadcrumbJsonLd(category: Category): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Trang chủ",
        item: toCanonicalUrl(toHomePath()),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Sản phẩm",
        item: toCanonicalUrl(toProductListPath()),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: category.name,
        item: toCanonicalUrl(category.seo?.canonicalUrl ?? toCategoryPath(category.slug)),
      },
    ],
  };
}

export function buildBrandBreadcrumbJsonLd(brand: Brand): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Trang chủ",
        item: toCanonicalUrl(toHomePath()),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Thương hiệu",
        item: toCanonicalUrl(toBrandListPath()),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: brand.name,
        item: toCanonicalUrl(brand.seo?.canonicalUrl ?? toBrandPath(brand.slug)),
      },
    ],
  };
}

export function buildWebSiteJsonLd(siteName: string, searchPath = "/tim-kiem/"): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: toCanonicalUrl(toHomePath()),
    potentialAction: {
      "@type": "SearchAction",
      target: `${toCanonicalUrl(searchPath)}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildOrganizationJsonLd(siteName: string, logoPath: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: toCanonicalUrl(toHomePath()),
    logo: toCanonicalUrl(logoPath),
  };
}

export function buildLocalBusinessJsonLd(
  name: string,
  logo: string,
  address: string,
  phone: string,
): JsonLdObject {
  const result: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    logo: toCanonicalUrl(logo),
    url: toCanonicalUrl(toHomePath()),
  };
  if (address) result.address = address;
  if (phone) result.telephone = phone;
  return result;
}

function collectProductImages(product: Product): string[] {
  const images = new Set<string>();

  if (product.image?.url) {
    images.add(product.image.url);
  }

  for (const image of product.gallery ?? []) {
    if (image?.url) {
      images.add(image.url);
    }
  }

  for (const variant of product.variants ?? []) {
    if (variant?.image?.url) {
      images.add(variant.image.url);
    }
  }

  return Array.from(images);
}

function buildProductOffers(product: Product, canonicalUrl: string, priceCurrency: string): JsonLdObject | undefined {
  const prices = [
    product.price?.salePrice,
    product.price?.retailPrice,
    ...(product.variants ?? []).flatMap((variant) => [
      variant?.price?.salePrice,
      variant?.price?.retailPrice,
    ]),
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (prices.length === 0) {
    return undefined;
  }

  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);

  if (lowPrice === highPrice) {
    return {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency,
      price: lowPrice,
      availability: stockStateToAvailability(product.stockState),
      itemCondition: "https://schema.org/NewCondition",
    };
  }

  return {
    "@type": "AggregateOffer",
    url: canonicalUrl,
    priceCurrency,
    lowPrice,
    highPrice,
    offerCount: prices.length,
    availability: stockStateToAvailability(product.stockState),
  };
}

function stockStateToAvailability(stockState: Product["stockState"]): string {
  switch (stockState) {
    case "IN_STOCK":
      return "https://schema.org/InStock";
    case "LOW_STOCK":
      return "https://schema.org/LimitedAvailability";
    case "PREORDER":
      return "https://schema.org/PreOrder";
    case "OUT_OF_STOCK":
    case "CONTACT_FOR_STOCK":
    default:
      return "https://schema.org/OutOfStock";
  }
}
