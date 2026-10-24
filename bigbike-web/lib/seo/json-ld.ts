import type {
  Article,
  Brand,
  Category,
  CategorySummary,
  GalleryMedia,
  Product,
  ProductVariant,
  VideoAsset,
} from "@/lib/contracts/public";
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
import { normalizeMetaDescription, stripHtmlToText } from "@/lib/utils/text";
import { derivePricing } from "@/lib/pricing";
import { resolveMediaUrl } from "@/lib/utils/format";
import { resolveLinkedVariant, withProductVariant } from "@/lib/utils/product-variant-link";

type JsonLdObject = Record<string, unknown>;
type SeoLocale = "vi" | "en";

const DEFAULT_ORG_LOGO_PATH = "/wp/logo.png";

function buildPublisher(
  siteName?: string,
  logoPath = DEFAULT_ORG_LOGO_PATH,
): JsonLdObject | undefined {
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

export function buildProductJsonLd(
  product: Product,
  canonicalPathOverride?: string,
  selectedVariantId?: string,
): JsonLdObject {
  const locale = localeFromPath(canonicalPathOverride);
  const canonicalUrl = toCanonicalUrl(
    canonicalPathOverride ?? product.seo?.canonicalUrl ?? toProductPath(product.slug, locale),
  );
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
  const variants = (product.variants ?? []).filter(
    (variant) => Boolean(variant.id) && Boolean(variant.name?.trim()),
  );
  const selectedVariant = resolveLinkedVariant(product, selectedVariantId);
  if (selectedVariant) {
    return {
      ...common,
      ...buildVariantProductJsonLd(selectedVariant, product, canonicalUrl),
      inProductGroupWithID: product.id,
      isVariantOf: { "@type": "ProductGroup", productGroupID: product.id, name: product.name },
    };
  }
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
    productGroupID: product.id,
    variesBy: buildVariesBy(variants),
    hasVariant: variants.map((variant) =>
      buildVariantProductJsonLd(variant, product, canonicalUrl),
    ),
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
  const canonicalUrl = toCanonicalUrl(
    canonicalPathOverride ?? article.seo?.canonicalUrl ?? toArticlePath(article.slug, locale),
  );
  const images = article.coverImage?.url ? [toCanonicalUrl(article.coverImage.url)] : [];
  const description = article.seo?.description?.trim()
    ? normalizeMetaDescription(article.seo.description)
    : normalizeMetaDescription(article.body);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.seo?.title ?? article.title,
    description: description || "",
    image: images.length > 0 ? images : undefined,
    datePublished: article.publishedAt ?? article.createdAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    inLanguage: locale,
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
      item: toCanonicalUrl(
        toCategoryPath(
          locale === "en"
            ? primaryCategory.slugEn?.trim() || primaryCategory.slug
            : primaryCategory.slug,
          locale,
        ),
      ),
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

export function buildArticleBreadcrumbJsonLd(
  article: Article,
  canonicalPathOverride?: string,
): JsonLdObject {
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
        toCategoryPath(
          locale === "en" ? parent.slugEn?.trim() || parent.slug : parent.slug,
          locale,
        ),
      ),
    });
  }

  items.push({
    "@type": "ListItem",
    position: items.length + 1,
    name: category.name,
    item: toCanonicalUrl(
      normalizeStorefrontUrl(
        canonicalPathOverride ??
          category.seo?.canonicalUrl ??
          toCategoryPath(category.slug, locale),
      ),
    ),
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

export function buildBrandBreadcrumbJsonLd(
  brand: Brand,
  canonicalPathOverride?: string,
): JsonLdObject {
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

export function buildWebSiteJsonLd(
  siteName: string,
  searchPath = "/tim-kiem/",
  locale: SeoLocale = "vi",
): JsonLdObject {
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
  const price = derivePricing(priceSource).current;
  if (!Number.isFinite(price) || price <= 0) {
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

function buildVariantProductJsonLd(
  variant: ProductVariant,
  product: Product,
  canonicalUrl: string,
): JsonLdObject {
  const price = variant.price ?? product.price;
  const stockState = variant.isAvailable ? "IN_STOCK" : "OUT_OF_STOCK";
  const variantUrl = withProductVariant(canonicalUrl, variant.id);
  const image = resolveMediaUrl(variant.image?.url ?? product.image?.url);
  return {
    "@type": "Product",
    "@id": `${canonicalUrl}#variant-${encodeURIComponent(variant.id)}`,
    name: `${product.name} - ${variant.name}`,
    sku: variant.sku ?? undefined,
    url: variantUrl,
    image: image ? [toCanonicalUrl(image)] : undefined,
    ...buildVariantDimensions(variant),
    offers: buildOffer(price, stockState, variantUrl),
  };
}

function buildVariesBy(variants: ProductVariant[]): string[] | undefined {
  const dimensions = variants.map(buildVariantDimensions);
  const fields: string[] = [];
  if (dimensions.every((variant) => variant.color)) fields.push("https://schema.org/color");
  if (dimensions.every((variant) => variant.size)) fields.push("https://schema.org/size");
  return fields.length > 0 ? fields : undefined;
}

function buildVariantDimensions(variant: ProductVariant): { color?: string; size?: string } {
  const dimensions: { color?: string; size?: string } = {};
  for (const option of variant.options ?? []) {
    const field = variantDimensionFromOptionName(option.name);
    const value = option.value?.trim();
    if (field && value && !dimensions[field]) dimensions[field] = value;
  }
  return dimensions;
}

function variantDimensionFromOptionName(name: string): "color" | "size" | undefined {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/(color|colour|mau)/.test(normalized)) return "color";
  if (/(size|kich co|kich thuoc)/.test(normalized)) return "size";
  return undefined;
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
    description: stripHtmlToText(description) || undefined,
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
  const videos = Array.isArray(productOrVideos)
    ? productOrVideos
    : collectDisplayedProductVideos(product);
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
    if (!id || seenIds.has(id) || !url || !name || !description || !uploadDate || !thumbnailUrl)
      continue;
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
    .filter(
      (media): media is GalleryMedia => media?.mediaType === "video" && Boolean(media.videoUrl),
    )
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
  const id = url?.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/,
  )?.[1];
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
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt)
    return `https://www.youtube-nocookie.com/embed/${yt[1]}?enablejsapi=1&playsinline=1&rel=0`;
  const tt = url.match(
    /(?:www\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/|video\/|v\/|embed\/v2\/|embed\/)(\d{6,30})/,
  );
  if (tt) return `https://www.tiktok.com/embed/v2/${tt[1]}`;
  if (
    /^https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?:[^?#]*\/videos\/|reel\/|watch\/?(?:\?|$)|[^?#]*video\.php)/i.test(
      url,
    )
  ) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  }
  return undefined;
}
