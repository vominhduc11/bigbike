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
  /** Hex colour from the term-level swatch metadata, e.g. "#a52a2a". */
  colorHex?: string | null;
  /** Term-level swatch thumbnail URL (resolved server-side from attachment id). */
  swatchImageUrl?: string | null;
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
  gallery?: ImageAsset[];
  isAvailable: boolean;
};

export type ProductSpecification = {
  name: string;
  value: string;
  group?: string;
};

export type ProductFaq = {
  question: string;
  answer: string;
};

export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
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
  name: string;
  shortDescription?: string;
  description?: string;
  brand?: BrandSummary;
  category: CategorySummary;
  categories?: CategorySummary[];
  image?: ImageAsset;
  gallery?: ImageAsset[];
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
  /** Rich-HTML installation guide rendered in PDP section "Hướng dẫn lắp đặt". Detail-only. */
  installationGuide?: string | null;
  /** Structured content blocks for the product description. Detail-only; null in list responses. */
  descriptionBlocks?: { type: string; [key: string]: unknown }[] | null;
  /** Product FAQ entries rendered in PDP section "Câu hỏi thường gặp". Detail-only. */
  faqs?: ProductFaq[];
  /**
   * Admin-curated related products shown in the PDP "Sản phẩm liên quan" section.
   * List-view shape. Detail-only; empty hides the section (no category fallback).
   */
  relatedProducts?: Product[];
  seo?: SeoMeta;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  parentId?: string | null;
  image?: ImageAsset;
  icon?: ImageAsset;
  seo?: SeoMeta;
  isVisible: boolean;
  showOnHomepage?: boolean | null;
  sortOrder?: number | null;
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
  priceBands: PriceBucket[];
};

export type AuthorSummary = {
  id: string;
  name: string;
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
  title: string;
  excerpt?: string;
  body: string;
  coverImage?: ImageAsset;
  productImage?: ImageAsset;
  author?: AuthorSummary;
  category?: ContentCategorySummary;
  categories?: ContentCategorySummary[];
  tags?: string[];
  /** Catalog products showcased in the "Sản phẩm sử dụng trong bài viết" section. */
  relatedProducts?: Product[];
  publishStatus: PublishStatus;
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
