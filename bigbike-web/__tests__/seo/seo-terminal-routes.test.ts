import { describe, expect, it } from "vitest";
import { GET as gone } from "@/app/seo/gone/route";
import { GET as notFound } from "@/app/seo/not-found/route";

// Trên production, route handler nhận URL gốc của khách chứ không nhận query của
// đích rewrite — proxy gửi tham số qua header `x-bigbike-seo-<tên>`. Các ca dưới
// mô phỏng đúng tình huống đó: URL không có query, chỉ có header.

function rewritten(path: string, params: Record<string, string>): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(params)) headers.set(`x-bigbike-seo-${name}`, value);
  return new Request(`https://bigbike.vn${path}`, { headers });
}

describe("trang SEO không tìm thấy", () => {
  it.each([
    [{ entity: "article", locale: "vi" }, "Không tìm thấy bài viết", 'lang="vi"', "/tin-tuc/"],
    [{ entity: "article", locale: "en" }, "Article not found", 'lang="en"', "/en/tin-tuc/"],
    [{ entity: "brand", locale: "vi" }, "Không tìm thấy thương hiệu", 'lang="vi"', "/brands/"],
    [{ entity: "brand", locale: "en" }, "Brand not found", 'lang="en"', "/en/brands/"],
  ])("đọc tham số từ header proxy %j", async (params, title, lang, listPath) => {
    const response = notFound(rewritten("/tin-tuc/bai-khong-ton-tai/", params));
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(html).toContain(`<title>${title} | BigBike</title>`);
    expect(html).toContain(lang);
    expect(html).toContain(`href="${listPath}"`);
  });

  it("vẫn đọc query khi gọi thẳng route", async () => {
    const response = notFound(
      new Request("https://bigbike.vn/seo/not-found/?entity=article&locale=en"),
    );

    expect(await response.text()).toContain("<title>Article not found | BigBike</title>");
  });
});

describe("trang SEO sản phẩm ngừng kinh doanh", () => {
  it("dùng ngôn ngữ và danh mục từ header proxy", async () => {
    const response = gone(
      rewritten("/en/sp/ls2-apollo-man.html", {
        locale: "en",
        category: "/en/products/helmets/",
      }),
    );
    const html = await response.text();

    expect(response.status).toBe(410);
    expect(html).toContain('lang="en"');
    expect(html).toContain('href="/en/products/helmets/"');
  });

  it("bỏ qua danh mục không phải đường dẫn nội bộ", async () => {
    const response = gone(rewritten("/sp/x.html", { locale: "vi", category: "//evil.example/" }));

    expect(await response.text()).toContain('href="/sp/"');
  });
});
