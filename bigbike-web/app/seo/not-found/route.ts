import { NextResponse } from "next/server";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function GET(request: Request): NextResponse {
  const url = new URL(request.url);
  const isEnglish = url.searchParams.get("locale") === "en";
  const homePath = isEnglish ? "/en/" : "/";
  const brandsPath = isEnglish ? "/en/brands/" : "/brands/";
  const title = isEnglish ? "Brand not found" : "Không tìm thấy thương hiệu";
  const description = isEnglish
    ? "The requested brand does not exist on BigBike."
    : "Thương hiệu bạn yêu cầu không tồn tại trên BigBike.";
  const homeLabel = isEnglish ? "Back to home" : "Về trang chủ";
  const brandsLabel = isEnglish ? "View all brands" : "Xem tất cả thương hiệu";
  const html = `<!doctype html><html lang="${isEnglish ? "en" : "vi"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} | BigBike</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><p><a href="${brandsPath}">${escapeHtml(brandsLabel)}</a> <a href="${homePath}">${escapeHtml(homeLabel)}</a></p></main></body></html>`;
  return new NextResponse(html, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
