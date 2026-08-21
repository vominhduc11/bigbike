import type { Article, Brand, Category, CategorySummary, GalleryMedia, Product, ProductVariant, VideoAsset } from "@/lib/contracts/public";
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
  const primaryCategory = product.category ?? product.categories?.[0];
  const common = {
    "@context": "https://schema.org",
    name: product.name,
    description: product.seo?.description ?? product.shortDescription ?? product.description ?? "",
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
    aggregateRating: buildAggregateRating(product),
  };

  // Historical/discontinued pages remain a single historical product at their
  // current address. They must not be recast as a saleable ProductGroup.
  const variants = (product.variants ?? []).filter((variant) => Boolean(variant.id) && Boolean(variant.name?.trim()));
  if (product.discontinued || variants.length === 0) {
    return {
      ...common,
      "@type": "Product",
      sku: product.sku ?? undefined,
      offers: buildProductOffers(product, canonicalUrl),
    };
  }

  return {
    ...common,
    "@type": "ProductGroup",
    productGroupID: product.sku ?? product.id,
    variesBy: buildVariesBy(variants),
    hasVariant: variants.map((variant) => buildVariantProductJsonLd(variant, product, canonicalUrl)),
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
  const images = article.coverImage?.url ? [toCanonicalUrl(article.coverImage.url)] : [];
  const authorName = article.authorName?.trim();

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
    author: authorName
      ? {
          "@type": "Person",
          name: authorName,
        }
      : undefined,
    publisher: buildPublisher(publisherName, publisherLogoPath),
  };
}

export function buildBreadcrumbJsonLd(
  product: Product,
  canonicalPathOverride?: string,
  breadcrumbCategories?: CategorySummary[],
): JsonLdObject {
  const locale = localeFromPath(canonicalPathOverride);
  const primaryCategory = product.category ?? product.categories?.[0];
  const items: Array<{ position: number; name: string; item: string }> = [
    {
      position: 1,
      name: locale === "en" ? "Home" : "Trang chủ",
      item: toCanonicalUrl(toHomePath(locale)),
    },
  ];

  // Breadcrumb của sản phẩm đi qua danh mục (kể cả danh mục cha), không đi qua
  // thương hiệu. Thương hiệu vẫn có liên kết riêng trong khu vực tên sản phẩm.
  const categories = (breadcrumbCategories ?? []).filter(isPublicProductCategory);
  if (categories.length > 0) {
    for (const category of categories) {
      items.push({
        position: items.length + 1,
        name: category.name,
        item: toCanonicalUrl(
          toCategoryPath(
            locale === "en" ? category.slugEn?.trim() || category.slug : category.slug,
            locale,
          ),
        ),
      });
    }
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
  const sameAs = (opts.sameAs ?? [])
    .filter((u): u is string => Boolean(u && u.trim()))
    .map((url) => toCanonicalUrl(url.trim()));
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
    images.add(toCanonicalUrl(product.image.url));
  }

  for (const media of product.gallery ?? []) {
    // V248: gallery hỗn hợp (ảnh + video) → chỉ lấy URL ảnh cho schema.org image[].
    if (media?.image?.url) {
      images.add(toCanonicalUrl(media.image.url));
    }
  }

  for (const variant of product.variants ?? []) {
    if (variant?.image?.url) {
      images.add(toCanonicalUrl(variant.image.url));
    }
  }

  return Array.from(images);
}

function buildProductOffers(product: Product, canonicalUrl: string): JsonLdObject | undefined {
  return buildOffer(product.price, product.stockState, canonicalUrl, product.discontinued === true);
}

function buildOffer(
  priceSource: Product["price"] | ProductVariant["price"],
  stockState: Product["stockState"],
  canonicalUrl: string,
  discontinued = false,
): JsonLdObject | undefined {
  const sale = priceSource?.salePrice;
  const retail = priceSource?.retailPrice;
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
    priceCurrency: priceSource?.currency ?? "VND",
    price,
    availability: discontinued
      ? "https://schema.org/Discontinued"
      : stockStateToAvailability(stockState),
    itemCondition: "https://schema.org/NewCondition",
  };
}

function buildVariantProductJsonLd(variant: ProductVariant, product: Product, canonicalUrl: string): JsonLdObject {
  const price = variant.price ?? product.price;
  const stockState = variant.isAvailable ? "IN_STOCK" : "OUT_OF_STOCK";
  return {
    "@type": "Product",
    "@id": `${canonicalUrl}#variant-${encodeURIComponent(variant.id)}`,
    name: `${product.name} - ${variant.name}`,
    sku: variant.sku ?? undefined,
    image: variant.image?.url ? [toCanonicalUrl(variant.image.url)] : undefined,
    offers: buildOffer(price, stockState, canonicalUrl),
  };
}

function buildVariesBy(variants: ProductVariant[]): string[] | undefined {
  const fields = new Set<string>();
  for (const option of variants.flatMap((variant) => variant.options ?? [])) {
    const normalized = option.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/(color|colour|mau)/.test(normalized)) fields.add("https://schema.org/color");
    if (/(size|kich co)/.test(normalized)) fields.add("https://schema.org/size");
  }
  return fields.size > 0 ? Array.from(fields) : undefined;
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
 * Structured data for the products visible on the current category page only.
 * `page`/`pageSize` keep ItemList positions continuous across pagination instead
 * of restarting at 1 on every page (SEO_RULE_007).
 */
export function buildCategoryCollectionJsonLd(
  category: Category,
  products: Product[],
  page: number,
  pageSize: number,
  canonicalPathOverride?: string,
  description = "",
): JsonLdObject {
  const locale = localeFromPath(canonicalPathOverride);
  const canonicalUrl = toCanonicalUrl(
    canonicalPathOverride ?? category.seo?.canonicalUrl ?? toCategoryPath(category.slug, locale),
  );
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : products.length || 1;
  const itemListElement = products.map((product, index) => {
    const productSlug = locale === "en" ? product.slugEn?.trim() || product.slug : product.slug;
    const url = toCanonicalUrl(toProductPath(productSlug, locale));
    return {
      "@type": "ListItem",
      position: (safePage - 1) * safePageSize + index + 1,
      name: product.name,
      url,
      item: {
        "@type": "Product",
        name: product.name,
        url,
      },
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description: stripHtmlToText(description),
    url: canonicalUrl,
    inLanguage: locale,
    image: category.image?.url ? [toCanonicalUrl(category.image.url)] : undefined,
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: itemListElement.length,
      itemListElement,
    },
  };
}

/** VideoObject is emitted only for a video the PDP actually displays. */
export function buildVideoObjectsJsonLd(product: Product): JsonLdObject[];
/** Kept for focused callers/tests that supply an already-visible video list. */
export function buildVideoObjectsJsonLd(videos: VideoAsset[], product: Product): JsonLdObject[];
export function buildVideoObjectsJsonLd(
  productOrVideos: Product | VideoAsset[],
  suppliedProduct?: Product,
): JsonLdObject[] {
  const product = Array.isArray(productOrVideos) ? suppliedProduct : productOrVideos;
  if (!product) return [];
  const videos = Array.isArray(productOrVideos) ? productOrVideos : collectDisplayedProductVideos(product);
  const canonicalUrl = toCanonicalUrl(product.seo?.canonicalUrl ?? toProductPath(product.slug));
  const seenIds = new Set<string>();
  const objects: JsonLdObject[] = [];

  for (const video of videos) {
    const id = video.id?.trim();
    const url = video.url?.trim();
    const name = video.title?.trim();
    const description = video.description?.trim();
    const uploadDate = video.uploadedOn?.trim() || product.createdAt?.trim();
    const embedUrl = url ? toVideoEmbedUrl(url) : undefined;
    const thumbnailUrl = video.thumbnail?.url?.trim() || youTubeThumbnailUrl(url);
    if (!id || seenIds.has(id) || !url || !name || !description || !uploadDate || !thumbnailUrl) continue;
    seenIds.add(id);

    objects.push({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "@id": `${canonicalUrl}#video-${encodeURIComponent(id)}`,
      name,
      description,
      thumbnailUrl: [toCanonicalUrl(thumbnailUrl)],
      uploadDate,
      duration: toIsoDuration(video.durationSeconds),
      publisher: {
        "@type": "Organization",
        name: "BigBike",
        url: toCanonicalUrl("/"),
      },
      embedUrl,
      contentUrl: embedUrl ? undefined : toCanonicalUrl(url),
    });
  }
  return objects;
}

function collectDisplayedProductVideos(product: Product): VideoAsset[] {
  const galleryVideos = (product.gallery ?? [])
    .filter((media): media is GalleryMedia => media?.mediaType === "video" && Boolean(media.videoUrl))
    .map((media) => ({
      id: media.id,
      url: media.videoUrl ?? undefined,
      provider: media.provider ?? media.videoProvider ?? undefined,
      title: media.title ?? undefined,
      titleEn: media.titleEn,
      thumbnail: media.image ?? null,
      description: media.description,
      descriptionEn: media.descriptionEn,
      durationSeconds: media.durationSeconds,
      uploadedOn: media.uploadedOn,
    }));
  return [...galleryVideos, ...(product.videos ?? [])];
}

function youTubeThumbnailUrl(url: string | undefined): string | undefined {
  const id = url?.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/)?.[1];
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : undefined;
}

function toIsoDuration(seconds: number | null | undefined): string | undefined {
  if (!Number.isInteger(seconds) || !seconds || seconds < 0) return undefined;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${remainingSeconds ? `${remainingSeconds}S` : ""}`;
}

function toVideoEmbedUrl(url: string): string | undefined {
  const yt = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
  );
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?enablejsapi=1&playsinline=1&rel=0`;
  const tt = url.match(
    /(?:www\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/|video\/|v\/|embed\/v2\/|embed\/)(\d{6,30})/,
  );
  if (tt) return `https://www.tiktok.com/embed/v2/${tt[1]}`;
  if (/^https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?:[^?#]*\/videos\/|reel\/|watch\/?(?:\?|$)|[^?#]*video\.php)/i.test(url)) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  }
  return undefined;
}
