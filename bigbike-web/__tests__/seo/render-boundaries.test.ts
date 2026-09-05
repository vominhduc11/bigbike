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
 * Hậu quả đo được trên container ngày 2026-08-06, khi loading boundary đặt sai ở
 * `app/[locale]/loading.tsx` còn
 * tồn tại: 6/6 URL rác trả HTTP 200 kèm HTML của HomeSkeleton; redirect 301/308 chuẩn
 * hoá slug EN (PRODUCT_RULE_003) im lặng không chạy; 410 Gone của sản phẩm đã xoá bị
 * nuốt thành 200.
 *
 * Một file `loading.tsx` thêm nhầm vào các thư mục dưới đây sẽ làm hỏng lại TOÀN BỘ
 * mã trạng thái mà không có test nào khác đỏ. Đó là lý do file test này tồn tại.
 */
const APP = join(process.cwd(), "app");
const LOCALE = join(APP, "[locale]");
const STOREFRONT = join(LOCALE, "(storefront)");

// Các route gọi notFound() và/hoặc permanentRedirect() khi render.
// [segment, file thực sự chứa guard] — `huong-dan/[...sub]` uỷ quyền sang GuidePage
// ở thư mục cha, các route còn lại giữ guard ngay trong page.tsx.
const STATUS_CRITICAL_SEGMENTS = [
  ["(storefront)/product/[slug]", "(storefront)/product/[slug]/page.tsx"],
  ["(storefront)/danh-muc/[slug]", "(storefront)/danh-muc/[slug]/page.tsx"],
  ["(storefront)/tin-tuc/[slug]", "(storefront)/tin-tuc/[slug]/page.tsx"],
  ["(storefront)/brands/[slug]", "(storefront)/brands/[slug]/page.tsx"],
  ["(storefront)/[slug]", "(storefront)/[slug]/page.tsx"],
  ["(storefront)/chinh-sach/[slug]", "(storefront)/chinh-sach/[slug]/page.tsx"],
  ["(storefront)/huong-dan/[...sub]", "(storefront)/huong-dan/GuidePage.tsx"],
] as const;

describe("Ranh giới stream — điều kiện để mã trạng thái HTTP hoạt động", () => {
  it("KHÔNG được có app/[locale]/loading.tsx (nó bọc cả app)", () => {
    expect(
      existsSync(join(LOCALE, "loading.tsx")),
      "Khung chờ chung phải nằm trong route group storefront/(home)/, xem app/[locale]/(storefront)/(home)/loading.tsx",
    ).toBe(false);
  });

  it("khung chờ trang chủ vẫn còn trong route group (storefront)/(home)", () => {
    expect(existsSync(join(STOREFRONT, "(home)", "loading.tsx"))).toBe(true);
    expect(existsSync(join(STOREFRONT, "(home)", "page.tsx"))).toBe(true);
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

      // …nhưng chỉ khi layout THỰC SỰ giữ guard. Một layout rỗng (vd chỉ khai
      // metadata) vẫn thoả điều kiện file tồn tại mà không chặn được gì, và khung
      // chờ lại quay về nuốt status. Kiểm chứng đo được 2026-09-05 trên dev server:
      // với guard ở layout, /product/{slug-sai}/ trả 404, /en/product/{slug-vi}/ trả
      // 308 kèm Location, và khung chờ vẫn hiện khi điều hướng phía client.
      if (hasLoading) {
        const layoutSource = readFileSync(join(dir, "layout.tsx"), "utf8");
        expect(
          /notFound\(\)|permanentRedirect\(/.test(layoutSource),
          `${segment}/layout.tsx phải giữ guard notFound()/permanentRedirect(), nếu không loading.tsx sẽ nuốt mã trạng thái`,
        ).toBe(true);
      }
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

  it("vẫn giữ trang 404 trong segment storefront (có header/footer)", () => {
    expect(existsSync(join(STOREFRONT, "not-found.tsx"))).toBe(true);
  });

  it.each([
    ["product/[slug]/page.tsx", "sản phẩm"],
    ["tin-tuc/[slug]/page.tsx", "bài viết"],
  ])("%s giữ render động để %s phát đúng status/Location", (relativeFile: string) => {
    const source = readFileSync(join(STOREFRONT, relativeFile), "utf8");
    expect(source).toContain('export const dynamic = "force-dynamic";');
  });

  it("trang tất cả sản phẩm và alias nội bộ luôn dựng động theo query lọc", () => {
    const productList = readFileSync(join(STOREFRONT, "sp", "page.tsx"), "utf8");
    const internalProductList = readFileSync(
      join(STOREFRONT, "internal", "sp", "page.tsx"),
      "utf8",
    );

    expect(productList).toContain('export const dynamic = "force-dynamic";');
    expect(internalProductList).toContain('export const dynamic = "force-dynamic";');
    expect(internalProductList).toContain("searchParams?: Promise<RouteSearchParams>");
    expect(internalProductList).toContain("ProductListPage({ params, searchParams })");
  });
});
