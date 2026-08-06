// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toInternalPaths } from "@/lib/utils/revalidation";

/**
 * Chặn hồi quy cho lỗi phát hiện 2026-08-06: mọi trang nằm dưới `app/[locale]`, nên
 * khoá bộ nhớ đệm luôn có tiền tố ngôn ngữ (`/vi`, `/en`). Trước đó route làm mới gọi
 * revalidatePath("/") — không khớp khoá `/vi` — nên sửa dữ liệu trong admin xong web
 * vẫn phục vụ bản cũ. Đây là lỗi VẬN HÀNH (giá, tồn kho, bài viết chậm cập nhật),
 * không chỉ SEO.
 */
describe("toInternalPaths", () => {
  it("gắn tiền tố ngôn ngữ cho trang chủ — KHÔNG bao giờ trả về '/' trần", () => {
    const paths = toInternalPaths("/");
    expect(paths).toEqual(["/vi", "/en"]);
    expect(paths).not.toContain("/");
  });

  // Bản EN cũng dùng đoạn tiếng Việt ở tầng nội bộ: proxy đổi /en/products/ →
  // /en/sp/, /en/about/ → /en/gioi-thieu/. Dịch đoạn ở đây là bắn trượt lần nữa.
  it("KHÔNG dịch đoạn đường dẫn cho bản tiếng Anh, chỉ gắn tiền tố", () => {
    expect(toInternalPaths("/sp/")).toEqual(["/vi/sp", "/en/sp"]);
    expect(toInternalPaths("/gioi-thieu/")).toEqual(["/vi/gioi-thieu", "/en/gioi-thieu"]);
    expect(toInternalPaths("/tin-tuc/")).toEqual(["/vi/tin-tuc", "/en/tin-tuc"]);
    expect(toInternalPaths("/brands/")).toEqual(["/vi/brands", "/en/brands"]);
  });

  it("giữ nguyên slug động và phát cho cả hai ngôn ngữ", () => {
    expect(toInternalPaths("/product/agv-k1s/")).toEqual([
      "/vi/product/agv-k1s",
      "/en/product/agv-k1s",
    ]);
    expect(toInternalPaths("/danh-muc/fullface/")).toEqual([
      "/vi/danh-muc/fullface",
      "/en/danh-muc/fullface",
    ]);
  });

  it("bỏ dấu gạch chéo cuối — revalidatePath so khớp phân biệt dạng này", () => {
    for (const path of toInternalPaths("/sp/")) {
      expect(path.endsWith("/")).toBe(false);
    }
  });

  it("luôn phủ cả hai ngôn ngữ, không trùng nhau", () => {
    for (const source of ["/", "/sp/", "/product/x/"]) {
      const paths = toInternalPaths(source);
      expect(new Set(paths).size).toBe(paths.length);
      expect(paths.some((p) => p.startsWith("/vi"))).toBe(true);
      expect(paths.some((p) => p.startsWith("/en"))).toBe(true);
    }
  });
});
