import type { Metadata } from "next";
import "./globals.css";

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
  title: "Không tìm thấy trang — BigBike",
  description: "Đường dẫn bạn truy cập không tồn tại trên bigbike.vn.",
  robots: { index: false, follow: false },
};

export default function RootNotFound() {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="bb-theme bg-background text-foreground min-h-full flex flex-col">
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
          <div className="relative select-none" aria-hidden="true">
            <span className="font-body font-bold text-9xl leading-none text-foreground/[0.07]">404</span>
            <span className="absolute inset-0 flex items-center justify-center font-cta text-5xl font-bold uppercase leading-none tracking-normal text-brand">
              404
            </span>
          </div>
          <h1 className="font-cta text-2xl font-bold uppercase">Không tìm thấy trang</h1>
          <p className="text-muted-foreground max-w-prose">
            Đường dẫn bạn truy cập không tồn tại hoặc đã được chuyển đi nơi khác.
          </p>
          {/* Cố ý dùng <a> thường, KHÔNG dùng next/link hay StorefrontLink:
              - StorefrontLink cần context locale của next-intl, mà trang này nằm NGOÀI
                segment [locale] nên không có context đó.
              - next/link bị chặn bởi guard i18n (__tests__/i18n/coverage.test.ts) đúng vì
                mọi link trong app phải đi qua StorefrontLink để giữ locale.
              Điều hướng đầy đủ về "/" là hành vi đúng ở đây: request mới đi qua proxy và
              được phân giải locale lại từ đầu. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="border-brand text-brand hover:bg-brand hover:text-background font-cta border px-6 py-3 text-sm font-bold uppercase transition-colors"
          >
            Về trang chủ
          </a>
        </main>
      </body>
    </html>
  );
}
