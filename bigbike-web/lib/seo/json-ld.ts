import type { Article, Brand, Category, Product, VideoAsset } from "@/lib/contracts/public";
import {
  normalizeStorefrontUrl,
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
import { stripHtmlToText } from "@/lib/utils/text";

type JsonLdObject = Record<string, unknown>;

const DEFAULT_ORG_LOGO_PATH = "/wp/logo.png";

function buildPublisher(siteName?: string, logoPath = DEFAULT_ORG_LOGO_PATH): JsonLdObject | undefined {
  if (!siteName) {
    return undefined;
  }

  return {
    "@type": "Organization",
    name: siteName,
    logo: {
      "@type": "ImageObject",
      url: toCanonicalUrl(logoPath),
    },
  };
}

export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function buildProductJsonLd(product: Product, canonicalPathOverride?: string): JsonLdObject {
  const canonicalUrl = toCanonicalUrl(canonicalPathOverride ?? product.seo?.canonicalUrl ?? toProductPath(product.slug));
  const images = collectProductImages(product);
  const priceCurrency = product.price?.currency ?? "VND";
  const offers = buildProductOffers(product, canonicalUrl, priceCurrency);
  const primaryCategory = product.category ?? product.categories?.[0];

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
    category: isPublicProductCategory(primaryCategory) ? primaryCategory.name : undefined,
    url: canonicalUrl,
    offers,
    // CHỈ khai aggregateRating khi có review khách thật (ratingCount > 0). Không
    // bao giờ khai khống — vi phạm guideline Google (checklist #23).
    aggregateRating: buildAggregateRating(product),
    // Ưu/Nhược điểm (V175) — pros & cons rich result.
    positiveNotes: buildNotesList(product.positiveNotes),
    negativeNotes: buildNotesList(product.negativeNotes),
  };
}

function buildNotesList(notes: { content: string }[] | undefined): JsonLdObject | undefined {
  const items = (notes ?? [])
    .map((note) => stripHtmlToText(note?.content ?? ""))
    .filter((content): content is string => Boolean(content));
  if (items.length === 0) {
    return undefined;
  }
  return {
    "@type": "ItemList",
    itemListElement: items.map((content, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: content,
    })),
  };
}

function buildAggregateRating(product: Product): JsonLdObject | undefined {
  const rating = product.rating;
  const count = product.ratingCount;
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0) {
    return undefined;
  }
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) {
    return undefined;
  }
  return {
    "@type": "AggregateRating",
    ratingValue: rating,
    reviewCount: count,
    bestRating: 5,
    worstRating: 1,
  };
}

export function buildArticleJsonLd(
  article: Article,
  publisherName?: string,
  publisherLogoPath = DEFAULT_ORG_LOGO_PATH,
  canonicalPathOverride?: string,
): JsonLdObject {
  const canonicalUrl = toCanonicalUrl(canonicalPathOverride ?? article.seo?.canonicalUrl ?? toArticlePath(article.slug));
  const images = article.coverImage?.url ? [article.coverImage.url] : [];

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.excerpt ?? "",
    image: images.length > 0 ? images : undefined,
    articleSection: article.category?.name ?? undefined,
    datePublished: article.publishedAt ?? article.createdAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    publisher: buildPublisher(publisherName, publisherLogoPath),
  };
}

export function buildBreadcrumbJsonLd(product: Product, canonicalPathOverride?: string): JsonLdObject {
  const primaryCategory = product.category ?? product.categories?.[0];
  const items: Array<{ position: number; name: string; item: string }> = [
    {
      position: 1,
      name: "Trang chủ",
      item: toCanonicalUrl(toHomePath()),
    },
  ];

  // Mirror đúng breadcrumb hiển thị trên PDP: ưu tiên thương hiệu, nếu không có
  // thì dùng danh mục (bỏ qua "chua-phan-loai"). Schema phải khớp UI (yêu cầu Google).
  if (product.brand?.name && product.brand.slug) {
    items.push({
      position: items.length + 1,
      name: product.brand.name,
      item: toCanonicalUrl(toBrandPath(product.brand.slug)),
    });
  } else if (isPublicProductCategory(primaryCategory)) {
    items.push({
      position: items.length + 1,
      name: primaryCategory.name,
      item: toCanonicalUrl(toCategoryPath(primaryCategory.slug)),
    });
  }

  items.push({
    position: items.length + 1,
    name: product.name,
    item: toCanonicalUrl(canonicalPathOverride ?? toProductPath(product.slug)),
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

function isPublicProductCategory(
  category: Product["category"],
): category is NonNullable<Product["category"]> {
  return Boolean(
    category?.name &&
    category.slug &&
    category.slug !== "chua-phan-loai" &&
    category.slug !== "uncategorized" &&
    category.visible !== false &&
    category.deleted !== true,
  );
}

export function buildArticleBreadcrumbJsonLd(article: Article, canonicalPathOverride?: string): JsonLdObject {
  const items: Array<{ position: number; name: string; item: string }> = [
    {
      position: 1,
      name: "Trang chủ",
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
    item: toCanonicalUrl(canonicalPathOverride ?? toArticlePath(article.slug)),
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

export function buildCategoryBreadcrumbJsonLd(
  category: Category,
  parent?: Category | null,
  canonicalPathOverride?: string,
): JsonLdObject {
  const items: Array<{ "@type": "ListItem"; position: number; name: string; item: string }> = [
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
  ];

  if (parent) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: parent.name,
      item: toCanonicalUrl(
        normalizeStorefrontUrl(parent.seo?.canonicalUrl ?? toCategoryPath(parent.slug)),
      ),
    });
  }

  items.push({
    "@type": "ListItem",
    position: items.length + 1,
    name: category.name,
    item: toCanonicalUrl(
      normalizeStorefrontUrl(
        canonicalPathOverride ?? category.seo?.canonicalUrl ?? toCategoryPath(category.slug),
      ),
    ),
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
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
  opts: {
    email?: string;
    /** Hồ sơ mạng xã hội / sàn TMĐT chính thức (Facebook, YouTube, TikTok, Shopee…). */
    sameAs?: string[];
    foundingDate?: string;
    areaServed?: string;
    priceRange?: string;
  } = {},
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
  if (opts.email) result.email = opts.email;
  const sameAs = (opts.sameAs ?? []).filter((u): u is string => Boolean(u && u.trim()));
  if (sameAs.length > 0) result.sameAs = sameAs;
  if (opts.foundingDate) result.foundingDate = opts.foundingDate;
  if (opts.areaServed) result.areaServed = { "@type": "City", name: opts.areaServed };
  if (opts.priceRange) result.priceRange = opts.priceRange;
  // CỐ Ý không khai aggregateRating ở đây: shop chưa có review thật trên hệ thống,
  // khai khống số sao vi phạm guideline Google. Chỉ thêm khi có dữ liệu thật.
  return result;
}

function collectProductImages(product: Product): string[] {
  const images = new Set<string>();

  if (product.image?.url) {
    images.add(product.image.url);
  }

  for (const media of product.gallery ?? []) {
    // V248: gallery hỗn hợp (ảnh + video) → chỉ lấy URL ảnh cho schema.org image[].
    if (media?.image?.url) {
      images.add(media.image.url);
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
  // Price is product-level only; variant prices are intentionally excluded so
  // SEO offers stay consistent with what the storefront actually displays.
  const sale = product.price?.salePrice;
  const retail = product.price?.retailPrice;
  const price =
    typeof sale === "number" && Number.isFinite(sale)
      ? sale
      : typeof retail === "number" && Number.isFinite(retail)
        ? retail
        : null;

  if (price === null) {
    return undefined;
  }

  return {
    "@type": "Offer",
    url: canonicalUrl,
    priceCurrency,
    price,
    availability: stockStateToAvailability(product.stockState),
    itemCondition: "https://schema.org/NewCondition",
  };
}

function stockStateToAvailability(stockState: Product["stockState"]): string {
  switch (stockState) {
    case "IN_STOCK":
      return "https://schema.org/InStock";
    case "OUT_OF_STOCK":
    default:
      return "https://schema.org/OutOfStock";
  }
}

export function buildFaqPageJsonLd(faqs: { question: string; answer: string }[]): JsonLdObject {
  if (faqs.length === 0) return {};
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripHtmlToText(faq.answer),
      },
    })),
  };
}

/**
 * VideoObject cho các video nhúng trong gallery PDP (checklist #20). Mỗi video
 * cần thumbnailUrl + uploadDate để Google chấp nhận — thiếu thumbnail thì bỏ qua
 * video đó thay vì khai schema lỗi. uploadDate dùng ngày tạo sản phẩm làm proxy
 * (không có ngày upload video riêng). YouTube → embedUrl; nguồn khác → contentUrl.
 */
export function buildVideoObjectsJsonLd(videos: VideoAsset[], product: Product): JsonLdObject[] {
  const fallbackThumb = product.image?.url ?? product.gallery?.[0]?.image?.url;
  const uploadDate = product.createdAt;

  return (videos ?? [])
    .map((video): JsonLdObject | null => {
      const url = video?.url?.trim();
      if (!url) return null;

      const thumbnailUrl = video.thumbnail?.url ?? fallbackThumb;
      if (!thumbnailUrl) return null;

      const name = video.title?.trim() || product.name;
      const embedUrl = toVideoEmbedUrl(url);

      return {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name,
        description: video.description?.trim() || video.title?.trim() || product.shortDescription || product.name,
        thumbnailUrl: [thumbnailUrl],
        uploadDate,
        embedUrl,
        contentUrl: embedUrl ? undefined : url,
      };
    })
    .filter((item): item is JsonLdObject => item !== null);
}

function toVideoEmbedUrl(url: string): string | undefined {
  const yt = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const tt = url.match(
    /(?:www\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/|video\/|v\/|embed\/v2\/|embed\/)(\d{6,30})/,
  );
  if (tt) return `https://www.tiktok.com/embed/v2/${tt[1]}`;
  if (/^https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?:[^?#]*\/videos\/|reel\/|watch\/?(?:\?|$)|[^?#]*video\.php)/i.test(url)) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  }
  return undefined;
}
