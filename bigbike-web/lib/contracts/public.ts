export type ApiMeta = {
  requestId: string;
  timestamp: string;
};

export type PaginationMeta = {
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

export type ApiErrorPayload = {
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
};

export type SliderImage = {
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

export type SeoMeta = {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: ImageAsset | null;
  noIndex?: boolean | null;
};

export type PublishStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "TRASH";

export type ProductStockState =
  | "IN_STOCK"
  | "LOW_STOCK"
  | "OUT_OF_STOCK";

export type ProductPrice = {
  retailPrice: number;
  compareAtPrice?: number | null;
  salePrice?: number | null;
  currency: "VND";
};

export type ProductVariantOption = {
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
  /** On-hand count for this specific variant when tracked. */
  stockQuantity?: number | null;
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

export type ProductSpecification = {
  name: string;
  value: string;
  group?: string;
};

/**
 * "Specs Dashboard" — một ô số liệu nổi bật ngay dưới khu vực mua hàng trên PDP (V235).
 * `value` là số liệu lớn (vd "24 tháng"), `label` là nhãn (vd "Bảo hành"). Admin quản theo
 * từng sản phẩm, tối đa 4 ô. Là "đòn chốt" bán hàng, KHÔNG phải thông số kỹ thuật.
 */
export type ProductSpecStat = {
  value: string;
  label: string;
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
  | { type: "video"; provider?: "youtube" | "upload"; url?: string; caption?: string }
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
      listStyle?: "bulleted" | "numbered";
      items?: string[];
    }
  // Phù hợp với ai (V246, từ V240) — danh sách thẻ tư vấn nhúng trong mô tả.
  // `html` (chế độ dán HTML): khi non-blank thì render html THAY cho cards.
  | {
      type: "suitability";
      title?: string;
      cards?: Array<{ audience?: string; advice?: string; linkLabel?: string; linkUrl?: string }>;
      html?: string;
    }
  // Bảng size (V246) — HTML tự do (thường là bảng) nhúng trong mô tả.
  | { type: "sizeGuide"; title?: string; html?: string };

/**
 * Cấu hình một tab PDP quản lý theo từng sản phẩm (V231). Public read trả `label`/`blocks` đã resolve
 * theo ngôn ngữ. `type` builtin (description/reviews/specs/installation/faq) lấy nội dung từ field sẵn
 * có; `custom` dùng `blocks`.
 */
export type ProductTabType =
  | "description"
  | "reviews"
  | "specs"
  | "installation"
  | "faq"
  | "custom";

export type ProductTab = {
  id: string;
  type: ProductTabType;
  enabled?: boolean;
  sortOrder?: number | null;
  /** Nhãn đã resolve theo ngôn ngữ; trống = dùng nhãn mặc định của tab builtin. */
  label?: string | null;
  /** Nội dung khối (tab tự do), đã resolve theo ngôn ngữ. */
  blocks?: DescriptionBlock[] | null;
};

export type ProductFaq = {
  question: string;
  answer: string;
};

/** Một dòng cam kết dưới nút mua hàng (V232) — admin quản theo từng sản phẩm. `icon` là key trong bộ icon dựng sẵn ở web. */
export type ProductCommitment = {
  icon: string;
  title: string;
  subtitle?: string | null;
};

/** Ưu/Nhược điểm (V175). `content` đã resolve theo ngôn ngữ; `contentEn` chỉ có trên admin. */
export type ProductHighlight = {
  content: string;
  contentEn?: string | null;
};

/** Một nhãn trên dải tin cậy TRÊN tên sản phẩm (V233) — admin quản theo từng sản phẩm. `content` đã resolve theo ngôn ngữ. */
export type TrustBadge = {
  content: string;
  contentEn?: string | null;
};

export type CategorySummary = {
  id: string;
  slug: string;
  /** Optional English URL slug of the category (V213). Null/absent when unset — used for PDP breadcrumb. */
  slugEn?: string | null;
  name: string;
};

export type BrandSummary = {
  id: string;
  slug: string;
  /** Optional English URL slug of the brand (V215). Null/absent when unset — used for PDP breadcrumb. */
  slugEn?: string | null;
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
  category: CategorySummary;
  categories?: CategorySummary[];
  image?: ImageAsset;
  gallery?: GalleryMedia[];
  videos?: VideoAsset[];
  price: ProductPrice;
  variants?: ProductVariant[];
  specifications?: ProductSpecification[];
  stockState: ProductStockState;
  /** Best-effort on-hand count at product level. Null when not tracked. */
  stockQuantity?: number | null;
  /** When true the product is forced out-of-stock regardless of variant state. */
  forceOutOfStock?: boolean | null;
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
  /** Rich-HTML promotion copy rendered in the PDP "Khuyến mãi" tab. */
  promotionContent?: string | null;
  /** Không còn hiển thị trên web (đã bỏ). Giữ field để không break API. Detail-only. */
  installationGuide?: string | null;
  /** Structured content blocks for the product description. Detail-only; null in list responses.
   *  Locale-resolved server-side (V229): EN blocks for `?lang=en`, falling back to VI. */
  descriptionBlocks?: DescriptionBlock[] | null;
  /** Per-product PDP tab configuration (V231). Null/empty → mặc định. Locale-resolved. Detail-only. */
  tabs?: ProductTab[] | null;
  /** Product FAQ entries rendered in PDP section "Câu hỏi thường gặp". Detail-only. */
  faqs?: ProductFaq[];
  /** Dòng cam kết dưới nút mua hàng (V232) — admin quản theo từng sản phẩm. Detail-only; rỗng → web ẩn khối. */
  commitments?: ProductCommitment[];
  /** "Specs Dashboard" — ô số liệu nổi bật dưới khu vực mua hàng (V235), tối đa 4. Detail-only; rỗng → web ẩn khối. */
  specStats?: ProductSpecStat[];
  /** Dải tin cậy trên tên sản phẩm (V233) — admin quản theo từng sản phẩm. Detail-only; rỗng → web ẩn dải. */
  trustBadges?: TrustBadge[];
  /** Ưu điểm (schema.org positiveNotes). Detail-only; empty in list. */
  positiveNotes?: ProductHighlight[];
  /** Nhược điểm (schema.org negativeNotes). Detail-only; empty in list. */
  negativeNotes?: ProductHighlight[];
  /** Dòng tự thêm cho khối "Mua tại BigBike.vn" — admin nhập tự do, không giới hạn số dòng.
   *  Đã resolve theo ngôn ngữ; rỗng → không render dòng nào. Detail-only. */
  purchaseLines?: Array<{ icon: string; label: string; value: string }> | null;
  /** "Thương hiệu [nước]". Detail-only. */
  originBrandCountry?: string | null;
  /** Bảng size dạng HTML (rich-text). Detail-only. */
  sizeGuide?: string | null;
  /** "Hiển thị trên web" (V245) — opaque JSON string `{sectionKey: boolean}`; admin bật/tắt từng
   *  section PDP. Null/thiếu = chưa cấu hình → hiện theo nội dung (legacy). Parse qua
   *  `parseSectionVisibility`. Detail-only. */
  sectionVisibility?: string | null;
  /** "Phù hợp với ai" — JSON array các thẻ `[{audience, advice, linkLabel?, linkUrl?}]`
   *  (V237; format đổi ở V240). Từ V246 render như khối mô tả (type "suitability"). Detail-only. */
  suitabilityAdvisory?: string | null;
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
  /** WP ACF "content_bottom" — SEO block shown below the product grid. */
  contentBottom?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Brand = {
  id: string;
  slug: string;
  /** Optional English URL slug (V215). Canonical `slug` stays vi; null/absent when unset. */
  slugEn?: string | null;
  name: string;
  description?: string;
  logo?: ImageAsset;
  bannerImage?: ImageAsset;
  mobileBannerImage?: ImageAsset;
  seo?: SeoMeta;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

/** One filter value + the count of published products matching it. */
export type FacetBucket = {
  key: string;
  label: string;
  /** Brand logo — only populated for brand buckets. */
  image?: ImageAsset | null;
  count: number;
};

/** A fixed price band + the count of products priced within it. */
export type PriceBucket = {
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

export type ContentCategorySummary = {
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
  seo?: SeoMeta;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PageType = "ABOUT" | "CONTACT" | "POLICY" | "HELP" | "CUSTOM";

export type Page = {
  id: string;
  slug: string;
  title: string;
  body: string;
  type: PageType;
  publishStatus: PublishStatus;
  seo?: SeoMeta;
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
  heroTitle?: string | null;
  heroDescription?: string | null;
  heroKicker?: string | null;
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

/** One enabled card of the admin-managed guide landing page (/huong-dan). Title/desc resolved by lang. */
export type GuideEntry = {
  pathSegment: string;
  pageSlug: string;
  icon: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
};

/** The admin-managed guide landing page (/huong-dan): hero + grid of cards. Resolved by lang. */
export type GuidePageLayout = {
  heroTitle: string | null;
  heroImageUrl: string | null;
  entries: GuideEntry[];
};

/** One enabled block of the admin-managed contact page (/lien-he). Labels/HTML already resolved by lang. */
export type ContactBlock = {
  type: "channel" | "address" | "hours" | "map" | "richtext";
  column: "main" | "online";
  sortOrder: number;
  icon: string | null;
  label: string | null;
  bindKey: string | null;
  value: string | null;
  href: string | null;
  html: string | null;
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
