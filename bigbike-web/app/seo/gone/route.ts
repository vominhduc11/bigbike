import { NextResponse } from "next/server";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safePath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\n")) {
    return fallback;
  }
  return value;
}

// Proxy truyền ngôn ngữ + danh mục qua header khi rewrite (xem `rewriteToSeoPage`
// trong proxy.ts); tham số trên URL chỉ còn dùng khi gọi thẳng route này.
function seoParam(request: Request, url: URL, name: string): string | null {
  return request.headers.get(`x-bigbike-seo-${name}`) ?? url.searchParams.get(name);
}

export function GET(request: Request): NextResponse {
  const url = new URL(request.url);
  const english = seoParam(request, url, "locale") === "en";
  const home = english ? "/en/" : "/";
  const category = safePath(seoParam(request, url, "category"), english ? "/en/products/" : "/sp/");
  const title = english
    ? "This product is no longer available"
    : "Sản phẩm này không còn kinh doanh";
  const message = english
    ? "The product page has been retired. Please browse products in the same category or return to the homepage."
    : "Sản phẩm này đã ngừng kinh doanh. Bạn có thể xem các sản phẩm cùng danh mục hoặc quay về trang chủ.";
  const categoryLabel = english ? "Browse the category" : "Xem danh mục cùng loại";
  const homeLabel = english ? "Go to homepage" : "Về trang chủ";

  const html = `<!doctype html>
<html lang="${english ? "en" : "vi"}">
  <head>
    <meta charset="utf-8">
    <meta name="robots" content="noindex,nofollow">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)} | BigBike</title>
  </head>
  <body>
    <main>
      <p>410</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="${escapeHtml(category)}">${escapeHtml(categoryLabel)}</a></p>
      <p><a href="${escapeHtml(home)}">${escapeHtml(homeLabel)}</a></p>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "public, max-age=300",
    },
  });
}
