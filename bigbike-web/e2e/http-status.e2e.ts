import { expect, test } from "@playwright/test";

/**
 * Mã trạng thái HTTP của các route chi tiết.
 *
 * Sự cố 2026-08-06: mọi URL không tồn tại trả HTTP 200 (soft-404) và redirect chuẩn
 * hoá slug tiếng Anh im lặng không chạy. Gốc rễ là loading boundary ở
 * `app/[locale]/loading.tsx` bọc cả
 * app: response bắt đầu stream trước khi notFound()/permanentRedirect() kịp chạy, mà
 * header đã gửi đi thì không đổi được mã trạng thái nữa (Next 16 —
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md,
 * mục "Status Codes").
 *
 * Ràng buộc cấu trúc tương ứng: __tests__/seo/render-boundaries.test.ts (chạy không
 * cần server). File này kiểm hành vi thật trên server đang chạy.
 */

// Sản phẩm có slug EN riêng — dùng để kiểm redirect chuẩn hoá (PRODUCT_RULE_003).
const PRODUCT_VI_SLUG = "balo-phuot-givi-ea104c";
const PRODUCT_EN_SLUG = "givi-ea104c-motorcycle-backpack";

test.describe("Không tìm thấy → 404 thật, không phải 200", () => {
  const missing = [
    "/product/khong-ton-tai-abc123/",
    "/danh-muc/khong-ton-tai-abc123/",
    "/tin-tuc/khong-ton-tai-abc123/",
    "/brands/khong-ton-tai-abc123/",
    "/slug-la-hoan-toan-999/",
    "/en/product/khong-ton-tai-abc123/",
    "/en/categories/khong-ton-tai-abc123/",
  ];

  for (const path of missing) {
    test(`${path} trả 404`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
    });
  }

  test("trang 404 phải có markup thật trong HTML do server dựng, không phải khung chờ trang chủ", async ({
    request,
  }) => {
    const response = await request.get("/product/khong-ton-tai-abc123/", { maxRedirects: 0 });
    const html = await response.text();

    // Khung chờ trang chủ (HomeSkeleton) từng bị trả về thay cho giao diện 404.
    // Từ 2026-09-05 các route chi tiết CÓ khung chờ riêng (guard nằm ở layout.tsx,
    // chạy trước ranh giới stream) — nên chốt bằng dấu hiệu chung của mọi khung chờ
    // thay vì tên một class cụ thể: HTML của trang 404 không được chứa khối chờ nào.
    expect(html).not.toContain('aria-busy="true"');
    // Thẻ noindex phải nằm trong HTML thô — bot không chạy JavaScript.
    expect(html).toMatch(/<meta name="robots"[^>]*content="[^"]*noindex/i);
  });
});

test.describe("Trang thật vẫn 200", () => {
  const alive = ["/", "/en/", "/sp/", "/en/products/", "/tin-tuc/", "/brands/"];

  for (const path of alive) {
    test(`${path} trả 200`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(200);
    });
  }

  test(`/en/product/${PRODUCT_EN_SLUG}/ (slug EN chuẩn) trả 200`, async ({ request }) => {
    const response = await request.get(`/en/product/${PRODUCT_EN_SLUG}/`, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
});

test.describe("PRODUCT_RULE_003 — chuẩn hoá slug tiếng Anh", () => {
  test("URL EN mang slug tiếng Việt phải chuyển hướng vĩnh viễn sang slug EN", async ({
    request,
  }) => {
    const response = await request.get(`/en/product/${PRODUCT_VI_SLUG}/`, { maxRedirects: 0 });

    // permanentRedirect() của Next phát 308 (redirect-status-code.js chỉ có 303/307/308).
    // Google xử lý 308 tương đương 301 — xem BUSINESS_RULES.md PRODUCT_RULE_003.
    expect([301, 308]).toContain(response.status());
    expect(response.headers().location).toContain(`/en/product/${PRODUCT_EN_SLUG}/`);
  });

  test("URL tiếng Việt giữ nguyên slug tiếng Việt, không chuyển hướng", async ({ request }) => {
    const response = await request.get(`/product/${PRODUCT_VI_SLUG}/`, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
});

test.describe("Trang xem thử phải noindex ở cả 2 ngôn ngữ", () => {
  for (const path of [
    "/preview/product/",
    "/preview/article/",
    "/en/preview/product/",
    "/en/preview/article/",
  ]) {
    test(`${path} có X-Robots-Tag noindex`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.headers()["x-robots-tag"]).toMatch(/noindex/i);
    });
  }
});

test.describe("SEO_RULE_004 — robots.txt không chặn trang đã noindex", () => {
  test("robots.txt chỉ chặn endpoint không render HTML", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();

    for (const blocked of ["/gio-hang/", "/dat-hang/", "/tai-khoan", "/tim-kiem", "/en/search/"]) {
      expect(body, `${blocked} phải tải được để Google đọc thẻ noindex`).not.toContain(
        `Disallow: ${blocked}`,
      );
    }
    expect(body).toContain("Disallow: /api/");
  });

  test("các trang tiện ích vẫn phát thẻ noindex trong HTML", async ({ request }) => {
    for (const path of ["/gio-hang/", "/dat-hang/", "/tim-kiem/", "/dang-nhap/", "/en/cart/"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      const html = await response.text();
      expect(html, `${path} thiếu thẻ noindex`).toMatch(
        /<meta name="robots"[^>]*content="[^"]*noindex/i,
      );
    }
  });
});
