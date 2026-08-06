import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";

const APP_DIR = join(process.cwd(), "app");
const NEXT_CONFIG = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

function collectDisallow(): string[] {
  const rules = robots().rules;
  const list = Array.isArray(rules) ? rules : [rules];
  return list.flatMap((rule) => {
    const disallow = rule?.disallow;
    if (!disallow) return [];
    return Array.isArray(disallow) ? disallow : [disallow];
  });
}

/**
 * Mọi route dưới đây phát thẻ `<meta name="robots" content="noindex">` do server dựng.
 * Cặp [đường dẫn công khai, file nguồn đặt cờ] — nếu ai đó gỡ cờ trong file nguồn,
 * test đọc-file bên dưới đỏ ngay.
 */
const NOINDEX_ROUTES: ReadonlyArray<readonly [path: string, source: string]> = [
  ["/gio-hang/", "app/[locale]/gio-hang/layout.tsx"],
  ["/en/cart/", "app/[locale]/gio-hang/layout.tsx"],
  ["/dat-hang/", "app/[locale]/dat-hang/layout.tsx"],
  ["/en/order/", "app/[locale]/dat-hang/layout.tsx"],
  ["/don-hang/", "app/[locale]/don-hang/xac-nhan/page.tsx"],
  ["/en/orders/", "app/[locale]/don-hang/xac-nhan/page.tsx"],
  ["/tai-khoan", "app/[locale]/tai-khoan/layout.tsx"],
  ["/en/account/", "app/[locale]/tai-khoan/layout.tsx"],
  ["/dang-nhap", "app/[locale]/dang-nhap/page.tsx"],
  ["/en/login/", "app/[locale]/dang-nhap/page.tsx"],
  ["/dang-ky", "app/[locale]/dang-ky/page.tsx"],
  ["/en/register/", "app/[locale]/dang-ky/page.tsx"],
  ["/quen-mat-khau", "app/[locale]/quen-mat-khau/page.tsx"],
  ["/en/forgot-password/", "app/[locale]/quen-mat-khau/page.tsx"],
  ["/xac-nhan-email", "app/[locale]/xac-nhan-email/page.tsx"],
  ["/en/verify-email/", "app/[locale]/xac-nhan-email/page.tsx"],
  ["/tim-kiem", "app/[locale]/tim-kiem/page.tsx"],
  ["/en/search/", "app/[locale]/tim-kiem/page.tsx"],
];

// Chỉ 3 tiền tố này được phép nằm trong Disallow: chúng không render HTML nên không
// mang được thẻ meta noindex.
const ALLOWED_DISALLOW = ["/api/", "/admin/", "/_internal/"];

describe("SEO_RULE_004 — không chặn robots.txt cái đã có thẻ noindex", () => {
  it("Disallow chỉ chứa những gì không gắn được thẻ noindex", () => {
    expect(collectDisallow().sort()).toEqual([...ALLOWED_DISALLOW].sort());
  });

  it.each(NOINDEX_ROUTES)(
    "%s có thẻ noindex nên KHÔNG được nằm trong Disallow",
    (path) => {
      const disallow = collectDisallow();
      // Google không tải được trang thì không đọc được thẻ noindex → URL đã lỡ index
      // nằm lại vĩnh viễn trong kết quả tìm kiếm.
      const blocked = disallow.filter((rule) => path.startsWith(rule) || rule.startsWith(path));
      expect(blocked).toEqual([]);
    },
  );

  it.each(NOINDEX_ROUTES)("%s vẫn thực sự đặt noindex trong %s", (_path, source) => {
    const contents = readFileSync(join(process.cwd(), source), "utf8");
    expect(contents).toMatch(/noIndex:\s*true|index:\s*false/);
  });

  it("URL .html legacy không bị chặn — Google phải thấy được redirect 301", () => {
    const disallow = collectDisallow();
    expect(disallow.some((rule) => rule.endsWith(".html"))).toBe(false);
  });

  it("vẫn khai sitemap", () => {
    expect(robots().sitemap).toMatch(/sitemap\.xml$/);
  });
});

describe("Trang xem thử phải noindex ở CẢ hai ngôn ngữ", () => {
  // /preview/* là "use client" nên không export generateMetadata được — noindex chỉ
  // đến từ X-Robots-Tag trong next.config.ts. localePrefix "as-needed" đặt bản EN ở
  // /en/preview/*, không khớp rule /preview/:path*.
  it.each(["/preview/:path*", "/en/preview/:path*"])(
    "next.config.ts có rule header cho %s",
    (source) => {
      expect(NEXT_CONFIG).toContain(`source: "${source}"`);
    },
  );

  it("rule preview mang X-Robots-Tag noindex, nofollow", () => {
    expect(NEXT_CONFIG).toMatch(/key:\s*"X-Robots-Tag",\s*value:\s*"noindex,\s*nofollow"/);
  });

  it("hai trang preview vẫn là client component (nên phải dựa vào header)", () => {
    for (const file of ["preview/product/page.tsx", "preview/article/page.tsx"]) {
      const contents = readFileSync(join(APP_DIR, "[locale]", file), "utf8");
      expect(contents.startsWith('"use client"')).toBe(true);
    }
  });
});
