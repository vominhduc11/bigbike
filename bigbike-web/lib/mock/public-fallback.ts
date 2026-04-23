import type {
  ApiDataResponse,
  ApiListResponse,
  Article,
  Brand,
  Category,
  Page,
  PaginationMeta,
  Product,
} from "@/lib/contracts/public";

type PageOptions = {
  page: number;
  size: number;
};

const categories: Category[] = [
  {
    id: "cat_helmet",
    slug: "mu-bao-hiem",
    name: "Mu bao hiem",
    description: "Danh muc mu bao hiem cho rider duong dai.",
    isVisible: true,
    image: {
      url: "https://placehold.co/1200x800",
      alt: "Danh muc mu bao hiem",
      width: 1200,
      height: 800,
    },
    createdAt: "2026-04-01T03:00:00Z",
    updatedAt: "2026-04-18T03:00:00Z",
    sortOrder: 1,
  },
  {
    id: "cat_jacket",
    slug: "ao-giap-bao-ho",
    name: "Ao giap bao ho",
    description: "Danh muc ao giap touring va di pho.",
    isVisible: true,
    image: {
      url: "https://placehold.co/1200x800",
      alt: "Danh muc ao giap bao ho",
      width: 1200,
      height: 800,
    },
    createdAt: "2026-04-01T03:00:00Z",
    updatedAt: "2026-04-18T03:00:00Z",
    sortOrder: 2,
  },
];

const brands: Brand[] = [
  {
    id: "brand_ls2",
    slug: "ls2",
    name: "LS2",
    description: "Thuong hieu mu bao hiem va do bao ho.",
    isVisible: true,
    logo: {
      url: "https://placehold.co/500x260",
      alt: "Thuong hieu LS2",
      width: 500,
      height: 260,
    },
    createdAt: "2026-04-01T03:00:00Z",
    updatedAt: "2026-04-18T03:00:00Z",
  },
];

const products: Product[] = [
  {
    id: "prod_ls2_ff800",
    sku: "LS2-FF800-RED-M",
    slug: "mu-bao-hiem-ls2-ff800",
    name: "Mu bao hiem LS2 FF800",
    shortDescription: "Mu fullface cho rider duong truong.",
    description: "Mu fullface khi dong hoc, lot thao roi, dat chuan ECE.",
    brand: {
      id: "brand_ls2",
      slug: "ls2",
      name: "LS2",
    },
    category: {
      id: "cat_helmet",
      slug: "mu-bao-hiem",
      name: "Mu bao hiem",
    },
    categories: [
      {
        id: "cat_helmet",
        slug: "mu-bao-hiem",
        name: "Mu bao hiem",
      },
    ],
    image: {
      id: "img_prod_ls2_ff800_main",
      url: "https://placehold.co/1200x1200",
      alt: "Mu bao hiem LS2 FF800",
      width: 1200,
      height: 1200,
      mimeType: "image/jpeg",
    },
    gallery: [
      {
        id: "img_prod_ls2_ff800_1",
        url: "https://placehold.co/1200x1200",
        alt: "LS2 FF800 goc nghieng",
        width: 1200,
        height: 1200,
        mimeType: "image/jpeg",
      },
    ],
    videos: [
      {
        id: "vid_ls2_ff800_review",
        url: "https://www.youtube.com/watch?v=ls2ff800-demo",
        provider: "YOUTUBE",
        title: "Review LS2 FF800",
      },
    ],
    price: {
      retailPrice: 3250000,
      compareAtPrice: 3690000,
      salePrice: 3250000,
      currency: "VND",
    },
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    variants: [],
    specifications: [
      {
        name: "Chuan an toan",
        value: "ECE 22.06",
        group: "An toan",
      },
    ],
    isFeatured: true,
    showOnHomepage: true,
    createdAt: "2026-04-01T05:00:00Z",
    updatedAt: "2026-04-18T06:30:00Z",
  },
  {
    id: "prod_ls2_city_rider",
    sku: "LS2-JACKET-CITY-BLK-L",
    slug: "ao-giap-ls2-city-rider",
    name: "Ao giap LS2 City Rider",
    shortDescription: "Ao giap touring thoang khi.",
    description: "Ao giap co bao ve vai, cui cho, lung.",
    brand: {
      id: "brand_ls2",
      slug: "ls2",
      name: "LS2",
    },
    category: {
      id: "cat_jacket",
      slug: "ao-giap-bao-ho",
      name: "Ao giap bao ho",
    },
    categories: [
      {
        id: "cat_jacket",
        slug: "ao-giap-bao-ho",
        name: "Ao giap bao ho",
      },
    ],
    image: {
      id: "img_prod_ls2_jacket_city_main",
      url: "https://placehold.co/1200x1200",
      alt: "Ao giap LS2 City Rider",
      width: 1200,
      height: 1200,
      mimeType: "image/jpeg",
    },
    gallery: [],
    videos: [],
    price: {
      retailPrice: 2450000,
      compareAtPrice: 2790000,
      salePrice: 2450000,
      currency: "VND",
    },
    stockState: "LOW_STOCK",
    publishStatus: "PUBLISHED",
    variants: [],
    specifications: [
      {
        name: "Chat lieu",
        value: "Luoi + chong mai mon",
        group: "Thong so",
      },
    ],
    isFeatured: false,
    showOnHomepage: true,
    createdAt: "2026-04-05T05:00:00Z",
    updatedAt: "2026-04-18T09:10:00Z",
  },
];

const articles: Article[] = [
  {
    id: "article_chon_mu_fullface",
    slug: "chon-mu-fullface-phu-hop",
    title: "Cach chon mu fullface phu hop",
    excerpt: "Huong dan chon mu theo nhu cau su dung.",
    body: "<p>Chon mu theo nhu cau di pho, touring, va form dau.</p>",
    coverImage: {
      id: "img_article_fullface",
      url: "https://placehold.co/1600x900",
      alt: "Huong dan chon mu fullface",
      width: 1600,
      height: 900,
      mimeType: "image/jpeg",
    },
    category: {
      id: "content_cat_guide",
      slug: "huong-dan",
      name: "Huong dan",
    },
    author: {
      id: "author_bigbike_editor",
      name: "BigBike Team",
    },
    publishStatus: "PUBLISHED",
    tags: ["mu-bao-hiem", "huong-dan"],
    createdAt: "2026-04-09T02:00:00Z",
    updatedAt: "2026-04-10T03:00:00Z",
    publishedAt: "2026-04-10T03:00:00Z",
  },
];

const pages: Page[] = [
  {
    id: "page_gioi_thieu",
    slug: "gioi-thieu",
    title: "Gioi thieu BigBike",
    body: "<p>BigBike la cua hang do bao ho va phu kien rider.</p>",
    type: "ABOUT",
    publishStatus: "PUBLISHED",
    createdAt: "2026-04-01T01:00:00Z",
    updatedAt: "2026-04-18T05:00:00Z",
    publishedAt: "2026-04-01T01:00:00Z",
  },
  {
    id: "page_chinh_sach_bao_hanh",
    slug: "chinh-sach-bao-hanh",
    title: "Chinh sach bao hanh",
    body: "<p>Chinh sach bao hanh ap dung theo tung nhom san pham.</p>",
    type: "POLICY",
    publishStatus: "PUBLISHED",
    createdAt: "2026-04-01T01:00:00Z",
    updatedAt: "2026-04-18T05:00:00Z",
    publishedAt: "2026-04-01T01:00:00Z",
  },
];

function createPagination(totalItems: number, options: PageOptions): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalItems / options.size));
  return {
    page: options.page,
    pageSize: options.size,
    totalItems,
    totalPages,
    hasNext: options.page < totalPages,
    hasPrevious: options.page > 1,
  };
}

function sliceByPage<T>(data: T[], options: PageOptions): T[] {
  const start = (options.page - 1) * options.size;
  const end = start + options.size;
  return data.slice(start, end);
}

function sortByField<T extends { createdAt?: string; name?: string }>(
  data: T[],
  sort: string | undefined,
): T[] {
  if (!sort) {
    return [...data];
  }

  const [field, directionRaw] = sort.split(":");
  const direction = directionRaw?.toLowerCase() === "asc" ? 1 : -1;

  const cloned = [...data];
  cloned.sort((a, b) => {
    if (field === "name") {
      return direction * String(a.name ?? "").localeCompare(String(b.name ?? ""));
    }
    if (field === "createdAt") {
      return direction * (new Date(a.createdAt ?? 0).valueOf() - new Date(b.createdAt ?? 0).valueOf());
    }
    return 0;
  });
  return cloned;
}

export function listProductsFallback(options: {
  page: number;
  size: number;
  category?: string;
  brand?: string;
  q?: string;
  sort?: string;
}): ApiListResponse<Product> {
  const search = options.q?.trim().toLowerCase();

  let filtered = [...products];
  if (options.category) {
    filtered = filtered.filter((item) => item.categories?.some((cat) => cat.slug === options.category));
  }
  if (options.brand) {
    filtered = filtered.filter((item) => item.brand?.slug === options.brand);
  }
  if (search) {
    filtered = filtered.filter((item) => {
      const source = `${item.name} ${item.shortDescription ?? ""}`.toLowerCase();
      return source.includes(search);
    });
  }

  const sorted = sortByField(filtered, options.sort);
  const pagination = createPagination(sorted.length, { page: options.page, size: options.size });
  const data = sliceByPage(sorted, { page: options.page, size: options.size });

  return {
    data,
    pagination,
    meta: {
      requestId: "dev-fallback-products",
      timestamp: new Date().toISOString(),
    },
  };
}

export function getProductBySlugFallback(slug: string): ApiDataResponse<Product> | null {
  const found = products.find((item) => item.slug === slug);
  if (!found) {
    return null;
  }
  return {
    data: found,
    meta: {
      requestId: "dev-fallback-product",
      timestamp: new Date().toISOString(),
    },
  };
}

export function listCategoriesFallback(options: { page: number; size: number; sort?: string }): ApiListResponse<Category> {
  const sorted = sortByField(categories, options.sort);
  const pagination = createPagination(sorted.length, { page: options.page, size: options.size });

  return {
    data: sliceByPage(sorted, { page: options.page, size: options.size }),
    pagination,
    meta: {
      requestId: "dev-fallback-categories",
      timestamp: new Date().toISOString(),
    },
  };
}

export function getCategoryBySlugFallback(slug: string): ApiDataResponse<Category> | null {
  const found = categories.find((item) => item.slug === slug);
  if (!found) {
    return null;
  }
  return {
    data: found,
    meta: {
      requestId: "dev-fallback-category",
      timestamp: new Date().toISOString(),
    },
  };
}

export function listBrandsFallback(options: { page: number; size: number; sort?: string }): ApiListResponse<Brand> {
  const sorted = sortByField(brands, options.sort);
  const pagination = createPagination(sorted.length, { page: options.page, size: options.size });

  return {
    data: sliceByPage(sorted, { page: options.page, size: options.size }),
    pagination,
    meta: {
      requestId: "dev-fallback-brands",
      timestamp: new Date().toISOString(),
    },
  };
}

export function getBrandBySlugFallback(slug: string): ApiDataResponse<Brand> | null {
  const found = brands.find((item) => item.slug === slug);
  if (!found) {
    return null;
  }
  return {
    data: found,
    meta: {
      requestId: "dev-fallback-brand",
      timestamp: new Date().toISOString(),
    },
  };
}

export function listArticlesFallback(options: {
  page: number;
  size: number;
  category?: string;
  q?: string;
  sort?: string;
}): ApiListResponse<Article> {
  const search = options.q?.trim().toLowerCase();
  let filtered = [...articles];

  if (options.category) {
    filtered = filtered.filter((item) => item.category?.slug === options.category);
  }
  if (search) {
    filtered = filtered.filter((item) => {
      const source = `${item.title} ${item.excerpt ?? ""}`.toLowerCase();
      return source.includes(search);
    });
  }

  const sorted = sortByField(filtered, options.sort);
  const pagination = createPagination(sorted.length, { page: options.page, size: options.size });
  return {
    data: sliceByPage(sorted, { page: options.page, size: options.size }),
    pagination,
    meta: {
      requestId: "dev-fallback-articles",
      timestamp: new Date().toISOString(),
    },
  };
}

export function getArticleBySlugFallback(slug: string): ApiDataResponse<Article> | null {
  const found = articles.find((item) => item.slug === slug);
  if (!found) {
    return null;
  }
  return {
    data: found,
    meta: {
      requestId: "dev-fallback-article",
      timestamp: new Date().toISOString(),
    },
  };
}

export function getPageBySlugFallback(slug: string): ApiDataResponse<Page> | null {
  const found = pages.find((item) => item.slug === slug);
  if (!found) {
    return null;
  }
  return {
    data: found,
    meta: {
      requestId: "dev-fallback-page",
      timestamp: new Date().toISOString(),
    },
  };
}

