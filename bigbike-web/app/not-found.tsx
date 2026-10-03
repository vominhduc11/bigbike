import type { Metadata } from "next";
import "./globals.css";
import { RootNotFoundView } from "./RootNotFoundView";

/**
 * Trang 404 cấp gốc — dành cho URL không khớp BẤT KỲ route nào (ví dụ `/a/b/c/`,
 * tức không vào được segment `[locale]`).
 *
 * Vì root layout của app là `app/[locale]/layout.tsx` (không có `app/layout.tsx`),
 * file này KHÔNG được layout nào bọc, nên phải tự phát `<html>` và `<body>` cùng
 * font và CSS. Trước khi có nó, các URL đó rơi vào trang mặc định của Next.js
 * ("404: This page could not be found." — tiếng Anh, không thương hiệu).
 *
 * URL có khớp route nhưng dữ liệu không tồn tại (sản phẩm/danh mục/bài viết đã xoá)
 * vẫn dùng `app/[locale]/(storefront)/not-found.tsx` — trang đó có header/footer đầy đủ.
 */
export const metadata: Metadata = {
  title: "404 — BigBike",
  description: "BigBike page not found.",
  robots: { index: false, follow: false },
};

export default function RootNotFound() {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="bb-theme min-h-full bg-background text-foreground">
        <RootNotFoundView />
      </body>
    </html>
  );
}
