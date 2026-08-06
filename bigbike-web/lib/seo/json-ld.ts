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
type SeoLocale = "vi" | "en";

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
  const locale = localeFromPath(canonicalPathOverride);
  const canonicalUrl = toCanonicalUrl(canonicalPathOverride ?? product.seo?.canonicalUrl ?? toProductPath(product.slug, locale));
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
    inLanguage: locale,
    offers,
    // CHỈ khai aggregateRating khi có review khách thật (ratingCount > 0). Không
    // bao giờ khai khống — vi phạm guideline Google (checklist #23).
    aggregateRating: buildAggregateRating(product),
    // CỐ Ý KHÔNG khai positiveNotes/negativeNotes (gỡ 2026-08-06, thay cho V175).
    // Google chỉ hỗ trợ rich result ưu/nhược điểm cho trang ĐÁNH GIÁ biên tập độc
    // lập, không cho trang bán hàng của chính người bán — khai ở đây là sai loại
    // trang và có nguy cơ bị phạt thủ công toàn site. Ưu/nhược điểm vẫn hiển thị
    // cho khách dưới dạng HTML thường qua <ProductProsCons>, chỉ không vào JSON-LD.
    // Không thêm lại dưới bất kỳ tên nào (positiveNotes, negativeNotes, Review, pros, cons).
  };
}

function buildAggregateRating(product: Product): JsonLdObject | undefined {
  const rating = product.rating;
  const count = product.ratingCount;
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0 || rating > 5) {
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
  const locale = localeFromPath(canonicalPathOverride);
  const canonicalUrl = toCanonicalUrl(canonicalPathOverride ?? article.seo?.canonicalUrl ?? toArticlePath(article.slug, locale));
  const images = article.coverImage?.url ? [article.coverImage.url] : [];

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.excerpt ?? "",
    image: images.length > 0 ? images : undefined,
    datePublished: article.publishedAt ?? article.createdAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    inLanguage: locale,
    publisher: buildPublisher(publisherName, publisherLogoPath),
  };
}

export function buildBreadcrumbJsonLd(product: Product, canonicalPathOverride?: string): JsonLdObject {
  const locale = localeFromPath(canonicalPathOverride);
  const primaryCategory = product.category ?? product.categories?.[0];
  const items: Array<{ position: number; name: string; item: string }> = [
    {
      position: 1,
      name: locale === "en" ? "Home" : "Trang chủ",
      item: toCanonicalUrl(toHomePath(locale)),
    },
  ];

  // Mirror đúng breadcrumb hiển thị trên PDP: ưu tiên thương hiệu, nếu không có
  // thì dùng danh mục (bỏ qua "chua-phan-loai"). Schema phải khớp UI (yêu cầu Google).
  if (product.brand?.name && product.brand.slug) {
    items.push({
      position: items.length + 1,
      name: product.brand.name,
      item: toCanonicalUrl(toBrandPath(product.brand.slug, locale)),
    });
  } else if (isPublicProductCategory(primaryCategory)) {
    items.push({
      position: items.length + 1,
      name: primaryCategory.name,
      item: toCanonicalUrl(toCategoryPath(locale === "en" ? primaryCategory.slugEn?.trim() || primaryCategory.slug : primaryCategory.slug, locale)),
    });
  }

  items.push({
    position: items.length + 1,
    name: product.name,
    item: toCanonicalUrl(canonicalPathOverride ?? toProductPath(product.slug, locale)),
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
  const locale = localeFromPath(canonicalPathOverride);
  const items: Array<{ position: number; name: string; item: string }> = [
    {
      position: 1,
      name: locale === "en" ? "Home" : "Trang chủ",
      item: toCanonicalUrl(toHomePath(locale)),
    },
    {
      position: 2,
      name: locale === "en" ? "News" : "Tin tức",
      item: toCanonicalUrl(toArticleListPath(locale)),
    },
  ];

  items.push({
    position: items.length + 1,
    name: article.title,
    item: toCanonicalUrl(canonicalPathOverride ?? toArticlePath(article.slug, locale)),
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
  const locale = localeFromPath(canonicalPathOverride);
  const items: Array<{ "@type": "ListItem"; position: number; name: string; item: string }> = [
    {
      "@type": "ListItem",
      position: 1,
      name: locale === "en" ? "Home" : "Trang chủ",
      item: toCanonicalUrl(toHomePath(locale)),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: locale === "en" ? "Products" : "Sản phẩm",
      item: toCanonicalUrl(toProductListPath(locale)),
    },
  ];

  if (parent) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: parent.name,
      item: toCanonicalUrl(
        toCategoryPath(locale === "en" ? parent.slugEn?.trim() || parent.slug : parent.slug, locale),
      ),
    });
  }

  items.push({
    "@type": "ListItem",
    position: items.length + 1,
    name: category.name,
    item: toCanonicalUrl(
      normalizeStorefrontUrl(
        canonicalPathOverride ?? category.seo?.canonicalUrl ?? toCategoryPath(category.slug, locale),
      ),
    ),
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

export function buildBrandBreadcrumbJsonLd(brand: Brand, canonicalPathOverride?: string): JsonLdObject {
  const locale = localeFromPath(canonicalPathOverride);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: locale === "en" ? "Home" : "Trang chủ",
        item: toCanonicalUrl(toHomePath(locale)),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: locale === "en" ? "Brands" : "Thương hiệu",
        item: toCanonicalUrl(toBrandListPath(locale)),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: brand.name,
        item: toCanonicalUrl(canonicalPathOverride ?? toBrandPath(brand.slug, locale)),
      },
    ],
  };
}

export function buildWebSiteJsonLd(siteName: string, searchPath = "/tim-kiem/", locale: SeoLocale = "vi"): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: toCanonicalUrl(toHomePath(locale)),
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: `${toCanonicalUrl(searchPath)}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildOrganizationJsonLd(siteName: string, logoPath: string, locale: SeoLocale = "vi"): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: toCanonicalUrl(toHomePath(locale)),
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
    locale?: SeoLocale;
    /**
     * Các dòng giờ mở cửa dạng chữ do admin nhập (settings `opening_hours_*`), ví dụ
     * "T2 - T7: 09h00 - 21h00". Dòng nào không tách được giờ thì BỎ QUA — thà thiếu
     * còn hơn khai sai giờ, vì khách đến nơi thấy đóng cửa sẽ đánh giá xấu trên Maps.
     */
    openingHours?: (string | null | undefined)[];
  } = {},
): JsonLdObject {
  const result: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    logo: toCanonicalUrl(logo),
    url: toCanonicalUrl(toHomePath(opts.locale ?? "vi")),
  };
  if (address) result.address = toPostalAddress(address);
  if (phone) result.telephone = phone;
  const openingHoursSpec = buildOpeningHoursSpecification(opts.openingHours);
  if (openingHoursSpec.length > 0) result.openingHoursSpecification = openingHoursSpec;
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

/**
 * Địa chỉ trong settings là một dòng chữ tự do; Google đọc PostalAddress có cấu trúc
 * tốt hơn nhiều so với chuỗi liền. Tách bảo thủ: cụm cuối cùng là tỉnh/thành, phần
 * còn lại là số nhà + đường + phường. Không có dấu phẩy thì giữ nguyên làm streetAddress.
 */
function toPostalAddress(address: string): JsonLdObject {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const result: JsonLdObject = { "@type": "PostalAddress", addressCountry: "VN" };
  if (parts.length >= 2) {
    result.streetAddress = parts.slice(0, -1).join(", ");
    result.addressLocality = parts[parts.length - 1];
  } else {
    result.streetAddress = address.trim();
  }
  return result;
}

// Chỉ số 0 = Thứ Hai … 6 = Chủ Nhật, khớp cách đánh số T2…T7/CN của tiếng Việt.
const SCHEMA_DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

function vietnameseDayIndex(token: string): number | null {
  const normalized = token.trim().toUpperCase();
  if (normalized === "CN") return 6;
  const match = normalized.match(/^T([2-7])$/);
  return match ? Number(match[1]) - 2 : null;
}

function parseDayTokens(text: string): string[] {
  const range = text.match(/\b(T[2-7]|CN)\s*[-–—]\s*(T[2-7]|CN)\b/i);
  if (range) {
    const from = vietnameseDayIndex(range[1]);
    const to = vietnameseDayIndex(range[2]);
    if (from === null || to === null || to < from) return [];
    return SCHEMA_DAY_NAMES.slice(from, to + 1);
  }
  const singles = text.match(/\b(T[2-7]|CN)\b/gi) ?? [];
  const indexes = singles
    .map(vietnameseDayIndex)
    .filter((index): index is number => index !== null);
  return [...new Set(indexes)].sort((a, b) => a - b).map((index) => SCHEMA_DAY_NAMES[index]);
}

function parseOpenCloseTimes(text: string): { opens: string; closes: string } | null {
  // Bỏ phần ký hiệu ngày trước khi dò giờ, nếu không "T7:" sẽ bị đọc nhầm thành 07:00.
  const timeText = text
    .replace(/\b(T[2-7]|CN)\b\s*[-–—]?\s*/gi, "")
    .replace(/^\s*:\s*/, "");
  const matches = [...timeText.matchAll(/(\d{1,2})\s*(?:h|:|giờ)\s*(\d{2})?/gi)];
  if (matches.length < 2) return null;
  const format = (match: RegExpMatchArray): string | null => {
    const hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    if (!Number.isInteger(hour) || hour > 23 || !Number.isInteger(minute) || minute > 59) {
      return null;
    }
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };
  const opens = format(matches[0]);
  const closes = format(matches[1]);
  return opens && closes ? { opens, closes } : null;
}

/**
 * Đổi các dòng giờ mở cửa dạng chữ ("T2 - T7: 09h00 - 21h00") sang
 * OpeningHoursSpecification. Dòng nào thiếu ngày hoặc thiếu giờ (ví dụ
 * "Lễ / Tết: nghỉ có thông báo") thì bỏ qua thay vì đoán.
 */
function buildOpeningHoursSpecification(lines: (string | null | undefined)[] | undefined): JsonLdObject[] {
  return (lines ?? [])
    .map((line): JsonLdObject | null => {
      const text = (line ?? "").trim();
      if (!text) return null;
      const dayOfWeek = parseDayTokens(text);
      const times = parseOpenCloseTimes(text);
      if (dayOfWeek.length === 0 || !times) return null;
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek,
        opens: times.opens,
        closes: times.closes,
      };
    })
    .filter((spec): spec is JsonLdObject => spec !== null);
}

function localeFromPath(path?: string): SeoLocale {
  return path === "/en" || path?.startsWith("/en/") ? "en" : "vi";
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
