import { describe, it, expect } from "vitest";
import robots from "@/app/robots";

function collectDisallow(result: ReturnType<typeof robots>): string[] {
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  return rules.flatMap((r) =>
    Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : [],
  );
}

// Ba assertion cũ ở file này (Disallow /xac-nhan-email, /tai-khoan, /dang-nhap) đã bị
// gỡ ngày 2026-08-06: chúng khoá đúng cái mâu thuẫn mà SEO_RULE_004 cấm — trang vừa
// có thẻ noindex vừa bị chặn tải, nên Google không bao giờ đọc được thẻ đó và không
// gỡ được URL đã lỡ index. Ràng buộc thay thế nằm ở __tests__/seo/robots-noindex.test.ts.
describe("robots()", () => {
  it("vẫn chặn các endpoint không render HTML (không gắn được thẻ noindex)", () => {
    const disallow = collectDisallow(robots());
    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/admin/");
    expect(disallow).toContain("/_internal/");
  });

  it("KHÔNG chặn các trang tiện ích đã có thẻ noindex", () => {
    const disallow = collectDisallow(robots());
    for (const path of [
      "/xac-nhan-email",
      "/tai-khoan",
      "/dang-nhap",
      "/dang-ky",
      "/quen-mat-khau",
      "/gio-hang/",
      "/dat-hang/",
      "/don-hang/",
      "/tim-kiem",
      "/en/account/",
      "/en/login/",
      "/en/search/",
    ]) {
      expect(disallow, `${path} phải được Google tải để đọc thẻ noindex`).not.toContain(path);
    }
  });

  it("includes sitemap URL", () => {
    expect(robots().sitemap).toMatch(/sitemap\.xml$/);
  });
});
