import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Khoá cơ chế phát mã trạng thái HTTP của các route chi tiết.
 *
 * Nguồn: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md
 * mục "Status Codes":
 *
 *   "When streaming, a 200 status code will be returned... Because the response headers
 *    have already been sent to the client, the status code of the response cannot be
 *    updated. [...] The response body starts streaming when a Suspense fallback renders
 *    (for example, a loading.tsx)... Place notFound() before those boundaries."
 *
 * `loading.tsx` tạo Suspense boundary bọc toàn bộ segment con
 * (node_modules/next/dist/client/components/layout-router.js: "If no loading property
 * is provided it renders the children without a suspense boundary").
 *
 * Hậu quả đo được trên container ngày 2026-08-06, khi `app/[locale]/loading.tsx` còn
 * tồn tại: 6/6 URL rác trả HTTP 200 kèm HTML của HomeSkeleton; redirect 301/308 chuẩn
 * hoá slug EN (PRODUCT_RULE_003) im lặng không chạy; 410 Gone của sản phẩm đã xoá bị
 * nuốt thành 200.
 *
 * Một file `loading.tsx` thêm nhầm vào các thư mục dưới đây sẽ làm hỏng lại TOÀN BỘ
 * mã trạng thái mà không có test nào khác đỏ. Đó là lý do file test này tồn tại.
 */
const APP = join(process.cwd(), "app");
const LOCALE = join(APP, "[locale]");

// Các route gọi notFound() và/hoặc permanentRedirect() khi render.
// [segment, file thực sự chứa guard] — `huong-dan/[...sub]` uỷ quyền sang GuidePage
// ở thư mục cha, các route còn lại giữ guard ngay trong page.tsx.
const STATUS_CRITICAL_SEGMENTS = [
  ["product/[slug]", "product/[slug]/page.tsx"],
  ["danh-muc/[slug]", "danh-muc/[slug]/page.tsx"],
  ["tin-tuc/[slug]", "tin-tuc/[slug]/page.tsx"],
  ["brands/[slug]", "brands/[slug]/page.tsx"],
  ["[slug]", "[slug]/page.tsx"],
  ["chinh-sach/[slug]", "chinh-sach/[slug]/page.tsx"],
  ["huong-dan/[...sub]", "huong-dan/GuidePage.tsx"],
] as const;

describe("Ranh giới stream — điều kiện để mã trạng thái HTTP hoạt động", () => {
  it("KHÔNG được có app/[locale]/loading.tsx (nó bọc cả app)", () => {
    expect(
      existsSync(join(LOCALE, "loading.tsx")),
      "Khung chờ chung phải nằm trong route group (home)/, xem app/[locale]/(home)/loading.tsx",
    ).toBe(false);
  });

  it("khung chờ trang chủ vẫn còn trong route group (home)", () => {
    expect(existsSync(join(LOCALE, "(home)", "loading.tsx"))).toBe(true);
    expect(existsSync(join(LOCALE, "(home)", "page.tsx"))).toBe(true);
  });

  it.each(STATUS_CRITICAL_SEGMENTS)(
    "%s không có loading.tsx (trừ khi cùng thư mục có layout.tsx giữ guard)",
    (segment: string) => {
      const dir = join(LOCALE, segment);
      const hasLoading = existsSync(join(dir, "loading.tsx"));
      const hasLayout = existsSync(join(dir, "layout.tsx"));
      // Lối thoát duy nhất: layout.tsx nằm TRÊN loading.tsx trong cây Next, nên nếu
      // guard notFound()/permanentRedirect() chuyển lên layout thì giữ được cả khung
      // chờ lẫn mã trạng thái đúng.
      expect(
        hasLoading && !hasLayout,
        `${segment}/loading.tsx sẽ nuốt mã trạng thái HTTP của route này`,
      ).toBe(false);
    },
  );

  it.each(STATUS_CRITICAL_SEGMENTS)(
    "%s thực sự có gọi notFound() hoặc redirect (trong %s)",
    (_segment, guardFile) => {
      const guard = join(LOCALE, guardFile);
      expect(existsSync(guard)).toBe(true);
      expect(readFileSync(guard, "utf8")).toMatch(/notFound\(\)|permanentRedirect\(/);
    },
  );

  it("có trang 404 cấp gốc cho URL không khớp route nào", () => {
    const rootNotFound = join(APP, "not-found.tsx");
    expect(existsSync(rootNotFound)).toBe(true);
    // Không có app/layout.tsx nên file này phải tự phát khung HTML.
    const contents = readFileSync(rootNotFound, "utf8");
    expect(contents).toContain("<html");
    expect(contents).toContain("<body");
  });

  it("vẫn giữ trang 404 trong segment [locale] (có header/footer)", () => {
    expect(existsSync(join(LOCALE, "not-found.tsx"))).toBe(true);
  });
});
