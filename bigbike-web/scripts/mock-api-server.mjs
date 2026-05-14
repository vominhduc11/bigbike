#!/usr/bin/env node
/**
 * BigBike Mock API Server — Phase 2 Typography Verification
 *
 * Minimal mock for http://localhost:8080 to supply product/category/page data
 * so the Next.js dev server renders product cards and PDP related-products section.
 *
 * Usage:
 *   node scripts/mock-api-server.mjs
 *
 * NOTE: This is a temporary verification tool only. Not committed to production paths.
 *       Stop with Ctrl+C when done.
 */

import http from "node:http";
import { URL } from "node:url";

const PORT = 8080;

// ── Shared helpers ─────────────────────────────────────────────────────────

const META = { requestId: "mock-001", timestamp: new Date().toISOString() };

function listResponse(data, total) {
  return {
    data,
    pagination: {
      page: 1,
      pageSize: Math.max(data.length, 24),
      totalItems: total ?? data.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
    meta: META,
  };
}

function dataResponse(data) {
  return { data, meta: META };
}

// ── Fixture: categories ────────────────────────────────────────────────────

const CAT_HELMET = {
  id: "cat-helmet",
  slug: "non-bao-hiem-moto",
  name: "Nón bảo hiểm moto",
  description: "Mũ bảo hiểm fullface, 3/4, cào cào các thương hiệu LS2, AGV, MT.",
  parentId: null,
  isVisible: true,
  showOnHomepage: true,
};

const CAT_JACKET = {
  id: "cat-jacket",
  slug: "ao-bao-ho-moto",
  name: "Áo bảo hộ moto",
  description: "Áo giáp vải, da, túi khí cho rider.",
  parentId: null,
  isVisible: true,
  showOnHomepage: true,
};

const CAT_BAG = {
  id: "cat-bag",
  slug: "balo-tui-deo",
  name: "Balô & túi đeo",
  description: "Balô chống nước, túi đeo biker.",
  parentId: null,
  isVisible: true,
  showOnHomepage: true,
};

const CATEGORIES = [CAT_HELMET, CAT_JACKET, CAT_BAG];

// ── Fixture: brands ───────────────────────────────────────────────────────

const BRAND_LS2 = { id: "brand-ls2", slug: "ls2", name: "LS2" };
const BRAND_AGV = { id: "brand-agv", slug: "agv", name: "AGV" };
const BRAND_ILM = { id: "brand-ilm", slug: "ilm", name: "ILM" };
const BRANDS = [
  { ...BRAND_LS2, description: "Thương hiệu mũ bảo hiểm Tây Ban Nha", isVisible: true },
  { ...BRAND_AGV, description: "Thương hiệu mũ bảo hiểm Ý", isVisible: true },
  { ...BRAND_ILM, description: "Thương hiệu phụ kiện biker", isVisible: true },
];

// ── Fixture: products ─────────────────────────────────────────────────────

const PRODUCTS = [
  {
    id: "p-ls2-koku",
    sku: "LS2-FF805-KOKU",
    slug: "ls2-koku-kidney-belt",
    name: "LS2 KOKU KIDNEY BELT",
    shortDescription: "Đai lưng bảo vệ thận LS2 cho rider.",
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    homepageBlock: "FEATURED_GRID",
    homepageOrder: 1,
    rating: 4.8,
    ratingCount: 24,
    brand: BRAND_LS2,
    category: CAT_JACKET,
    categories: [CAT_JACKET],
    price: {
      retailPrice: 2_500_000,
      salePrice: 1_990_000,
      compareAtPrice: 2_800_000,
      currency: "VND",
    },
  },
  {
    id: "p-ilm-bl01",
    sku: "ILM-BL01",
    slug: "tui-chong-nuoc-ilm-bl01",
    name: "TÚI CHỐNG NƯỚC ILM BL01",
    shortDescription: "Túi chống nước gắn ghi đông.",
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    homepageBlock: "FEATURED_GRID",
    homepageOrder: 2,
    rating: 4.5,
    ratingCount: 12,
    brand: BRAND_ILM,
    category: CAT_BAG,
    categories: [CAT_BAG],
    price: {
      retailPrice: 1_560_000,
      currency: "VND",
    },
  },
  // ── Additional helmets so ls2-koku-kidney-belt PDP has same-cat related ──
  {
    id: "p-agv-k6",
    sku: "AGV-K6-BLK",
    slug: "agv-k6-helmet",
    name: "MŨ BẢO HIỂM AGV K6",
    shortDescription: "Mũ fullface AGV K6 Racing.",
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    homepageBlock: "RECOMMENDED_CAROUSEL",
    homepageOrder: 3,
    rating: 4.9,
    ratingCount: 31,
    brand: BRAND_AGV,
    category: CAT_JACKET,
    categories: [CAT_JACKET],
    price: {
      retailPrice: 8_900_000,
      salePrice: 7_500_000,
      currency: "VND",
    },
  },
  {
    id: "p-ls2-ff800",
    sku: "LS2-FF800-STORM",
    slug: "ls2-ff800-storm-ii",
    name: "MŨ LS2 FF800 STORM II",
    shortDescription: "Mũ fullface LS2 FF800 STORM II.",
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    homepageBlock: "RECOMMENDED_CAROUSEL",
    homepageOrder: 4,
    rating: 4.7,
    ratingCount: 18,
    brand: BRAND_LS2,
    category: CAT_JACKET,
    categories: [CAT_JACKET],
    price: {
      retailPrice: 5_500_000,
      salePrice: 4_990_000,
      currency: "VND",
    },
  },
];

// Lookup by slug
const PRODUCT_BY_SLUG = Object.fromEntries(PRODUCTS.map((p) => [p.slug, p]));

// ── Fixture: articles ─────────────────────────────────────────────────────

const ARTICLES = [
  {
    id: "art-1",
    slug: "tai-nghe-bluetooth-5-3-la-gi",
    title: "Tai nghe Bluetooth 5.3 là gì?",
    excerpt: "Tìm hiểu về công nghệ Bluetooth 5.3 trên tai nghe cho rider.",
    body: "<p>Bluetooth 5.3 là chuẩn kết nối không dây mới nhất, cho phép rider nghe nhạc và nhận cuộc gọi an toàn.</p>",
    publishStatus: "PUBLISHED",
    publishedAt: "2026-03-01T08:00:00Z",
    isFeatured: true,
    category: { id: "arc-1", slug: "tin-tuc-biker", name: "Tin tức biker" },
  },
  {
    id: "art-2",
    slug: "chon-mu-bao-hiem-fullface",
    title: "Cách chọn mũ bảo hiểm fullface phù hợp",
    excerpt: "Hướng dẫn chọn size và thương hiệu mũ fullface cho rider.",
    body: "<p>Mũ fullface bảo vệ toàn bộ đầu và cằm. Cần chọn size chuẩn và chứng nhận ECE hoặc DOT.</p>",
    publishStatus: "PUBLISHED",
    publishedAt: "2026-04-15T08:00:00Z",
    isFeatured: false,
    category: { id: "arc-1", slug: "tin-tuc-biker", name: "Tin tức biker" },
  },
];

const ARTICLE_BY_SLUG = Object.fromEntries(ARTICLES.map((a) => [a.slug, a]));

// ── Fixture: settings ─────────────────────────────────────────────────────

const SETTINGS = [
  { settingKey: "site_name", settingValue: "BigBike", settingGroup: "general" },
  { settingKey: "site_description", settingValue: "Shop đồ bảo hộ biker", settingGroup: "general" },
  { settingKey: "contact_hotline", settingValue: "0909 123 456", settingGroup: "contact" },
  { settingKey: "contact_email", settingValue: "shop@bigbike.vn", settingGroup: "contact" },
  { settingKey: "contact_address", settingValue: "123 Lê Văn Việt, Quận 9, TP.HCM", settingGroup: "contact" },
  { settingKey: "contact_map_embed", settingValue: "https://www.google.com/maps/embed?pb=!1m18", settingGroup: "contact" },
  { settingKey: "seo_home_title", settingValue: "BigBike — Đồ bảo hộ biker chính hãng", settingGroup: "seo" },
  { settingKey: "seo_home_description", settingValue: "Shop đồ bảo hộ moto BigBike", settingGroup: "seo" },
];

// ── Fixture: pages ────────────────────────────────────────────────────────

const PAGES = {
  "lien-he": {
    id: "page-lienhe",
    slug: "lien-he",
    title: "Liên hệ BigBike",
    body: "<p>BigBike hỗ trợ tư vấn và giải đáp mọi thắc mắc về sản phẩm bảo hộ biker.</p>",
    type: "CONTACT",
    publishStatus: "PUBLISHED",
  },
  "gioi-thieu": {
    id: "page-gioi-thieu",
    slug: "gioi-thieu",
    title: "Về BigBike",
    body: "<p>BigBike là chuỗi cửa hàng đồ bảo hộ biker chuyên nghiệp tại TP.HCM.</p>",
    type: "STATIC",
    publishStatus: "PUBLISHED",
  },
};

// ── Fixture: sliders ──────────────────────────────────────────────────────

const SLIDERS = [
  {
    id: "slider-1",
    sortOrder: 1,
    location: "home",
    desktopImage: { url: null, alt: "Banner BigBike", width: 1920, height: 600 },
    mobileImage: { url: null, alt: "Banner BigBike mobile", width: 768, height: 400 },
    externalLink: null,
    productLink: null,
  },
];

// ── Routing ───────────────────────────────────────────────────────────────

function filterProducts(products, query) {
  let result = [...products];
  if (query.category) {
    result = result.filter((p) => p.category?.slug === query.category);
  }
  if (query.homepage_block) {
    result = result.filter((p) => p.homepageBlock === query.homepage_block);
  }
  if (query.q) {
    const q = query.q.toLowerCase();
    result = result.filter((p) => p.name.toLowerCase().includes(q));
  }
  return result;
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`[mock] ${req.method} ${path}`);

  // ── GET /api/v1/products ────────────────────────────────────────────────
  if (path === "/api/v1/products" && req.method === "GET") {
    const filtered = filterProducts(PRODUCTS, query);
    const page = parseInt(query.page ?? "1", 10);
    const size = parseInt(query.size ?? "24", 10);
    const sliced = filtered.slice((page - 1) * size, page * size);
    const totalPages = Math.max(1, Math.ceil(filtered.length / size));
    res.writeHead(200);
    res.end(
      JSON.stringify({
        data: sliced,
        pagination: {
          page,
          pageSize: size,
          totalItems: filtered.length,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        meta: META,
      }),
    );
    return;
  }

  // ── GET /api/v1/products/:slug ─────────────────────────────────────────
  const prodMatch = path.match(/^\/api\/v1\/products\/([^/]+)$/);
  if (prodMatch && req.method === "GET") {
    const product = PRODUCT_BY_SLUG[prodMatch[1]];
    if (product) {
      res.writeHead(200);
      res.end(JSON.stringify(dataResponse(product)));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    }
    return;
  }

  // ── GET /api/v1/categories ─────────────────────────────────────────────
  if (path === "/api/v1/categories" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(listResponse(CATEGORIES)));
    return;
  }

  // ── GET /api/v1/categories/:slug ───────────────────────────────────────
  const catMatch = path.match(/^\/api\/v1\/categories\/([^/]+)$/);
  if (catMatch && req.method === "GET") {
    const cat = CATEGORIES.find((c) => c.slug === catMatch[1]);
    if (cat) {
      res.writeHead(200);
      res.end(JSON.stringify(dataResponse(cat)));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    }
    return;
  }

  // ── GET /api/v1/brands ─────────────────────────────────────────────────
  if (path === "/api/v1/brands" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(listResponse(BRANDS)));
    return;
  }

  // ── GET /api/v1/articles ───────────────────────────────────────────────
  if (path === "/api/v1/articles" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(listResponse(ARTICLES)));
    return;
  }

  // ── GET /api/v1/articles/:slug ─────────────────────────────────────────
  const artMatch = path.match(/^\/api\/v1\/articles\/([^/]+)$/);
  if (artMatch && req.method === "GET") {
    const article = ARTICLE_BY_SLUG[artMatch[1]];
    if (article) {
      res.writeHead(200);
      res.end(JSON.stringify(dataResponse(article)));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    }
    return;
  }

  // ── GET /api/v1/settings/public ───────────────────────────────────────
  if (path === "/api/v1/settings/public" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(dataResponse(SETTINGS)));
    return;
  }

  // ── GET /api/v1/sliders ───────────────────────────────────────────────
  if (path === "/api/v1/sliders" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(dataResponse(SLIDERS)));
    return;
  }

  // ── GET /api/v1/home-videos ───────────────────────────────────────────
  if (path === "/api/v1/home-videos" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(dataResponse([])));
    return;
  }

  // ── GET /api/v1/pages/:slug ───────────────────────────────────────────
  const pageMatch = path.match(/^\/api\/v1\/pages\/([^/]+)$/);
  if (pageMatch && req.method === "GET") {
    const pg = PAGES[pageMatch[1]];
    if (pg) {
      res.writeHead(200);
      res.end(JSON.stringify(dataResponse(pg)));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    }
    return;
  }

  // ── GET /api/v1/menus/:location ──────────────────────────────────────
  if (path.startsWith("/api/v1/menus/") && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(dataResponse({ location: "header", items: [] })));
    return;
  }

  // ── GET /api/v1/search ────────────────────────────────────────────────
  if (path === "/api/v1/search" && req.method === "GET") {
    const q = (query.q ?? "").toLowerCase();
    const results = PRODUCTS.filter((p) => p.name.toLowerCase().includes(q));
    res.writeHead(200);
    res.end(JSON.stringify(listResponse(results)));
    return;
  }

  // ── Catch-all: 404 ───────────────────────────────────────────────────
  console.log(`[mock] 404 → ${path}`);
  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found", path }));
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`[mock] BigBike Mock API running at http://localhost:${PORT}`);
  console.log(`[mock] Products: ${PRODUCTS.length} | Categories: ${CATEGORIES.length} | Articles: ${ARTICLES.length}`);
  console.log(`[mock] Press Ctrl+C to stop.`);
});
