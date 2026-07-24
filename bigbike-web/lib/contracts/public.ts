 type ApiMeta = {
  requestId: string;
  timestamp: string;
};

 type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type ApiErrorDetail = {
  field: string | null;
  code: string;
  message: string;
};

 type ApiErrorPayload = {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
};

export type ApiErrorResponse = {
  error: ApiErrorPayload;
  meta?: ApiMeta;
};

export type ApiDataResponse<T> = {
  data: T;
  meta: ApiMeta;
};

export type ApiListResponse<T> = {
  data: T[];
  pagination: PaginationMeta;
  meta: ApiMeta;
};

export type ImageAsset = {
  id?: string;
  url?: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
};

/**
 * Một mục trong dải media (gallery) của sản phẩm/biến thể (V248): ảnh HOẶC video.
 * `mediaType="image"` → dùng `image`. `mediaType="video"` → `videoUrl`+`provider` là video,
 * `image` là thumbnail/poster (có thể null → web tự lấy auto-thumb YouTube / first-frame).
 * Tách biệt với `videos` (mục "Video" riêng dưới PDP).
 */
export type GalleryMedia = {
  mediaType?: "image" | "video";
  image?: ImageAsset | null;
  videoUrl?: string | null;
  provider?: string | null;
  videoProvider?: string | null;
};

 type SliderImage = {
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
};

export type HomeSlider = {
  id: string;
  sortOrder?: number;
  location?: string;
  desktopImage?: SliderImage | null;
  mobileImage?: SliderImage | null;
  productId?: string | null;
  externalLink?: string | null;
  /**
   * Computed by the backend from the linked product's slug: `/san-pham/<slug>`.
   * Populated only when `productId` is set and the product exists.
   * Consumers (e.g. `app/page.tsx#toHeroSlide`) prefer `link` first, then fall back
   * to `productLink`, then `externalLink`.
   */
  productLink?: string | null;
  /**
   * Legacy/imported field: a pre-computed absolute or relative URL that overrides
   * both `productLink` and `externalLink`. Set during WordPress data extraction
   * (`scripts/extract-wp-data/extract.ts`) and may be absent on sliders created
   * via the admin API. Consumers should check this field first.
   */
  link?: string | null;
  /** Linked product's display name — lets the caption render without a separate product-detail fetch. */
  productName?: string | null;
  /** Linked product's primary category name. */
  categoryName?: string | null;
  /** Linked product's SKU — rendered as the banner's "product code" caption. */
  sku?: string | null;
  product?: unknown | null;
};

export type VideoAsset = {
  id?: string;
  url?: string;
  title?: string;
  thumbnail?: ImageAsset | null;
  provider?: string | null;
  /** Mô tả 2–3 câu nội dung video (V175) → caption + VideoObject.description. */
  description?: string | null;
};

 type SeoMeta = {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: ImageAsset | null;
  noIndex?: boolean | null;
};

/** DRAFT/PUBLISHED/TRASH are the only active states. HIDDEN is legacy-only (migrated to
 *  DRAFT — see backend V324, 2026-07-07); kept here purely because web only ever reads this
 *  field and a residual pre-migration response could theoretically still carry it. Never treat
 *  it as meaning anything beyond "not PUBLISHED". */
export type PublishStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "TRASH";

export type ProductStockState =
  | "IN_STOCK"
  | "OUT_OF_STOCK";

export type ProductPrice = {
  retailPrice: number;
  salePrice?: number | null;
  currency: "VND";
};

 type ProductVariantOption = {
  name: string;
  value: string;
};

export type ProductVariant = {
  id: string;
  sku?: string;
  name: string;
  options: ProductVariantOption[];
  price?: ProductPrice;
  stockState: ProductStockState;
  /** Cover image used in chip thumbnails / cart line items. */
  image?: ImageAsset | null;
  /**
   * Color-scoped variant gallery (mirrors WP `rtwpvg_images` but normalized
   * so every size of the same color exposes the same gallery). The PDP only
   * swaps to this list when Color changes; non-color options fall back to the
   * current color gallery or product-level gallery.
   */
  gallery?: GalleryMedia[];
  isAvailable: boolean;
};

/**
 * Structured description block (V139 + V229). Authored in the admin BlockEditor and rendered on the
 * PDP. Shapes mirror the admin editor / backend `DescriptionBlock` polymorphic JSON.
 */
export type DescriptionBlock =
  | { type: "heading"; level?: number; text?: string }
  | { type: "paragraph"; html?: string }
  | { type: "list"; style?: "bulleted" | "numbered"; items?: string[] }
  | { type: "image"; url?: string; alt?: string; caption?: string }
  | { type: "video"; provider?: "youtube" | "tiktok" | "facebook" | "upload"; url?: string; caption?: string }
  | { type: "callout"; variant?: "info" | "warning" | "note"; html?: string }
  | { type: "divider" }
  | {
      type: "feature";
      side?: "auto" | "left" | "right";
      url?: string;
      alt?: string;
      caption?: string;
      subheading?: string;
      heading?: string;
      html?: string;
    };

/** "Phù hợp với ai" (V240) — danh sách thẻ tư vấn, section riêng cố định trên PDP. Tách khỏi
 *  `descriptionBlocks` ở V327/V328 (trước đó là khối `type: "suitability"` trong mảng đó). `html` là
 *  nguồn render duy nhất — không còn fallback cấu trúc `cards`. */
export type SuitabilitySection = {
  title?: string;
  html?: string;
};

/** "Bảng size" (V246) — HTML tự do (thường là bảng), section riêng cố định trên PDP. Tách khỏi
 *  `descriptionBlocks` ở V327/V328 (trước đó là khối `type: "sizeGuide"` trong mảng đó). */
export type SizeGuideSection = {
  title?: string;
  html?: string;
};

 type ProductFaq = {
  question: string;
  answer: string;
};

/** Một dòng cam kết dưới nút mua hàng (V232) — admin quản theo từng sản phẩm. `icon` là key trong bộ icon dựng sẵn ở web. */
export type ProductCommitment = {
  icon: string;
  title: string;
  subtitle?: string | null;
};

/** Ưu/Nhược điểm (V175). `content` là rich-text HTML đã resolve theo ngôn ngữ; `contentEn` chỉ có trên admin. */
export type ProductHighlight = {
  content: string;
  contentEn?: string | null;
};

/**
 * Wire response (2026-07-07) gộp `positiveNotes`/`negativeNotes` thành 1 field lồng
 * `highlights`. Un-nest về lại field phẳng trên `Product` ngay tại tầng fetch — mọi
 * component (ProductView, json-ld, LocalizedContent) tiếp tục đọc field phẳng như cũ.
 */
export function withFlatHighlights<T extends Record<string, unknown>>(raw: T): T {
  const source = raw as T & {
    highlights?: { positiveNotes?: ProductHighlight[] | null; negativeNotes?: ProductHighlight[] | null } | null;
  };
  if (!source || typeof source !== "object" || !("highlights" in source)) {
    return raw;
  }
  const { highlights, ...rest } = source;
  return {
    ...rest,
    positiveNotes: highlights?.positiveNotes ?? [],
    negativeNotes: highlights?.negativeNotes ?? [],
  } as unknown as T;
}

export type CategorySummary = {
  id: string;
  slug: string;
  /** Optional English URL slug of the category (V213). Null/absent when unset — used for PDP breadcrumb. */
  slugEn?: string | null;
  name: string;
  /** A retained historical product link may point to a hidden or soft-deleted category. */
  visible?: boolean;
  deleted?: boolean;
};

export type BrandSummary = {
  id: string;
  slug: string;
  name: string;
};

export type Product = {
  id: string;
  sku?: string;
  slug: string;
  /** Optional English URL slug (V214). Canonical `slug` stays vi; null/absent when unset. */
  slugEn?: string | null;
  name: string;
  shortDescription?: string;
  description?: string;
  brand?: BrandSummary;
  /** First member of `categories`; retained for breadcrumb/SEO compatibility. */
  category?: CategorySummary;
  categories?: CategorySummary[];
  image?: ImageAsset;
  gallery?: GalleryMedia[];
  videos?: VideoAsset[];
  price: ProductPrice;
  variants?: ProductVariant[];
  stockState: ProductStockState;
  publishStatus: PublishStatus;
  /** Homepage placement slot. NONE = not pinned to homepage. */
  homepageBlock: "NONE" | "FEATURED_GRID";
  /**
   * Manual pin priority inside the homepageBlock.
   * Lower number = appears earlier; null = unpinned (sorted to the end by createdAt DESC).
   */
  homepageOrder?: number | null;
  /** Denormalized cache of the approved-review average for fast listing/detail reads. */
  rating?: number | null;
  /** Denormalized cache of the approved-review count for fast listing/detail reads. */
  ratingCount?: number | null;
  /** Long-form rich-HTML SEO copy rendered at the bottom of the PDP. */
  contentBottom?: string | null;
  /** Structured content blocks for the product description. Detail-only; null in list responses.
   *  Locale-resolved server-side (V229): EN blocks for `?lang=en`, falling back to VI. Since
   *  V327/V328 only 4 block types remain here (paragraph/image/feature×2) — suitability/sizeGuide
   *  moved to the 2 fields below. */
  descriptionBlocks?: DescriptionBlock[] | null;
  /** "Phù hợp với ai" (V240, tách khỏi descriptionBlocks ở V327/V328). Detail-only; null in list.
   *  Locale-resolved server-side. */
  suitabilitySection?: SuitabilitySection | null;
  /** "Bảng size" (V246, tách khỏi descriptionBlocks ở V327/V328). Detail-only; null in list.
   *  Locale-resolved server-side. */
  sizeGuideSection?: SizeGuideSection | null;
  /** Product FAQ entries rendered in PDP section "Câu hỏi thường gặp". Detail-only. */
  faqs?: ProductFaq[];
  /** Dòng cam kết dưới nút mua hàng (V232) — admin quản theo từng sản phẩm. Detail-only; rỗng → web ẩn khối. */
  commitments?: ProductCommitment[];
  /** Ưu điểm (schema.org positiveNotes). Detail-only; empty in list. */
  positiveNotes?: ProductHighlight[];
  /** Nhược điểm (schema.org negativeNotes). Detail-only; empty in list. */
  negativeNotes?: ProductHighlight[];
  /** "Thương hiệu [nước]". Detail-only. */
  originBrandCountry?: string | null;
  /** Bảng size dạng HTML (rich-text). Detail-only. */
  sizeGuide?: string | null;
  /** "Phù hợp với ai" — JSON array các thẻ `[{audience, advice, linkLabel?, linkUrl?}]`
   *  (V237; format đổi ở V240). Từ V246 render như khối mô tả (type "suitability"). Detail-only. */
  suitabilityAdvisory?: string | null;
  /** "Dán mã HTML" cho khối Thông số kỹ thuật (V255) — HTML (sanitizeRichHtml, cho phép `<table>`) là
   *  nguồn render DUY NHẤT, không còn bảng có cấu trúc để fallback. Detail-only. */
  specifications?: string | null;
  /** "Dán mã HTML" cho khối "Ô số liệu nổi bật" (specStats, V256) — HTML (sanitizeRichHtml, cho phép
   *  CSS inline) là nguồn render DUY NHẤT, không còn lưới ô số liệu có cấu trúc để fallback. Detail-only. */
  specStats?: string | null;
  /** "Dán mã HTML" cho khối "Dải tin cậy" (trustBadges, V257) — HTML (sanitizeRichHtml, cho phép CSS
   *  inline) là nguồn render DUY NHẤT, không còn dải badge có cấu trúc để fallback. Detail-only. */
  trustBadges?: string | null;
  /** "Quick Answer" (trả lời nhanh, V300) — đoạn tóm tắt AIO 40–60 từ, hiển thị blockquote ngay
   *  sau Specs Dashboard, trước "Tính năng chi tiết". Max 600 ký tự. Locale-resolved. Detail-only. */
  quickAnswerSummary?: string | null;
  /** Giới tính mục tiêu: "Nam" | "Nữ" | "Unisex". Null = chưa gắn. */
  gender?: string | null;
  /**
   * Admin-curated related products shown in the PDP "Sản phẩm liên quan" section.
   * List-view shape. Detail-only; empty hides the section (no category fallback).
   */
  relatedProducts?: Product[];
  /**
   * Admin-curated accessory products ("Phụ kiện" — sản phẩm bán kèm) shown in the PDP
   * "Phụ kiện" section. List-view shape. Detail-only; empty hides the section.
   */
  accessoryProducts?: Product[];
  seo?: SeoMeta;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  slug: string;
  /** Optional English URL slug (V213). Canonical `slug` stays vi; null/absent when unset. */
  slugEn?: string | null;
  name: string;
  description?: string;
  parentId?: string | null;
  image?: ImageAsset;
  icon?: ImageAsset;
  /**
   * Monochrome line-icon for the header menu + "Danh mục sản phẩm" filter sidebar,
   * rendered via CSS mask-image (e.g. /wp/icon-N.svg). Distinct from `icon` (the
   * category hero illustration, WP ACF "image_left"). Null when not set. DB-driven (V213).
   */
  menuIconUrl?: string | null;
  bannerImage?: ImageAsset;
  mobileBannerImage?: ImageAsset;
  seo?: SeoMeta;
  isVisible: boolean;
  showOnHomepage?: boolean | null;
  sortOrder?: number | null;
  /** Khối giới thiệu hiển thị ở ĐẦU trang danh mục (trên lưới sản phẩm).
   *  Cột intro_content (đổi tên từ content_bottom — WP ACF cũ — qua V290). */
  introContent?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logo?: ImageAsset;
  bannerImage?: ImageAsset;
  mobileBannerImage?: ImageAsset;
  seo?: SeoMeta;
  isVisible: boolean;
  showOnHomepage?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** One filter value + the count of published products matching it. */
 type FacetBucket = {
  key: string;
  label: string;
  /** Brand logo — only populated for brand buckets. */
  image?: ImageAsset | null;
  count: number;
};

/** A fixed price band + the count of products priced within it. */
 type PriceBucket = {
  key: string;
  label: string;
  minPrice?: number | null;
  /** Null for the open-ended top band. */
  maxPrice?: number | null;
  count: number;
};

/** Aggregated product counts powering the catalog filter sidebar. */
export type CatalogFacets = {
  categories: FacetBucket[];
  brands: FacetBucket[];
  colors: FacetBucket[];
  genders: FacetBucket[];
  priceBands: PriceBucket[];
};

 type ContentCategorySummary = {
  id: string;
  slug: string;
  name: string;
};

/** A content (news) category plus its count of published articles — powers the Tin tức filter. */
export type ContentCategoryWithCount = {
  id: string;
  slug: string;
  name: string;
  articleCount: number;
};

export type Article = {
  id: string;
  slug: string;
  /** Optional English URL slug (V216). Canonical `slug` stays vi; null/absent when unset. */
  slugEn?: string | null;
  title: string;
  excerpt?: string;
  body: string;
  coverImage?: ImageAsset;
  /** ACF product_image overlay used by the Experience Carousel. Null when not set. */
  productImage?: ImageAsset | null;
  category?: ContentCategorySummary;
  categories?: ContentCategorySummary[];
  publishStatus: PublishStatus;
  /** Khi true, bài thuộc nhóm "Tin nổi bật" — lọc qua `GET /api/v1/articles?featured=true`. */
  featured?: boolean;
  /** Khi true, bài được chọn vào carousel "Góc trải nghiệm" trang chủ — lọc qua `?homeExperience=true` (V272). */
  homeExperience?: boolean;
  seo?: SeoMeta;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicMenuItem = {
  id: string;
  parentId: string | null;
  label: string;
  url: string;
  sortOrder: number;
  openInNewTab: boolean;
  cssClass: string | null;
  /**
   * Icon URL resolved by the backend from category slug in the URL.
   * Null for non-category menu items. Static WP parity mapping via
   * /wp/icon-N.svg in Next.js public folder.
   * TODO: populated from CategoryEntity.iconUrl when DB icons are set.
   */
  iconUrl?: string | null;
};

export type PublicMenu = {
  location: string;
  name: string;
  items: PublicMenuItem[];
};

export type HomeVideo = {
  id: string;
  sortOrder: number;
  title: string;
  videoUrl: string;
  youtubeId: string | null;
  embedUrl: string | null;
  autoThumbnailUrl: string | null;
  thumbnail: ImageAsset | null;
};

export type HomeHighlightItem = {
  slot: number;
  productId: string;
  productSlug: string;
  productName: string;
  productImageUrl: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
};

export type PublicSiteSetting = {
  settingKey: string;
  settingValue: string;
  settingGroup: string | null;
};

export type ClientError = {
  status: number;
  code: string;
  message: string;
  details: ApiErrorDetail[];
};

export type DataResult<T> = {
  data: T | null;
  error: ClientError | null;
};

export type ListResult<T> = {
  data: T[];
  pagination: PaginationMeta | null;
  error: ClientError | null;
};
