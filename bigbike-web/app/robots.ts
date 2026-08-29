import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/utils/routes";

/**
 * SEO_RULE_004 — chỉ `Disallow` những gì KHÔNG gắn được thẻ noindex.
 *
 * Trước 2026-08-06 file này chặn luôn mọi route đã có `noIndex: true` trong code
 * (giỏ hàng, thanh toán, đơn hàng, tài khoản, đăng nhập/ký, quên mật khẩu, tìm kiếm,
 * xác nhận email — cả 2 ngôn ngữ). Đó là mâu thuẫn tự chặn chính mình: Google không
 * tải được trang thì không đọc được thẻ noindex, nên các URL đã lỡ index nằm lại
 * trong kết quả tìm kiếm ở dạng "không có thông tin" và không có cách nào gỡ ra.
 * Các URL `.html` legacy cũng vậy — bị chặn thì Google không thấy được redirect 301
 * mà proxy đã cấu hình.
 *
 * Cách đúng: để Google tải trang và đọc thẻ noindex (đã có sẵn, xem bảng dưới).
 * Chỉ `/api/`, `/admin/` và `/_internal/` ở lại vì chúng không render HTML nên
 * không mang được thẻ meta.
 *
 * Thẻ noindex tương ứng nằm ở:
 *   /gio-hang/              app/[locale]/(storefront)/gio-hang/layout.tsx
 *   /dat-hang/              app/[locale]/(storefront)/dat-hang/layout.tsx
 *   /don-hang/xac-nhan/     app/[locale]/(storefront)/don-hang/xac-nhan/page.tsx
 *   /tai-khoan/*            app/[locale]/(storefront)/tai-khoan/layout.tsx  (+ proxy 307 về đăng nhập)
 *   /dang-nhap/             app/[locale]/(auth)/dang-nhap/page.tsx
 *   /dang-ky/               app/[locale]/(auth)/dang-ky/page.tsx
 *   /quen-mat-khau/         app/[locale]/(auth)/quen-mat-khau/page.tsx
 *   /xac-nhan-email/        app/[locale]/(auth)/xac-nhan-email/page.tsx
 *   /tim-kiem/              app/[locale]/(storefront)/tim-kiem/page.tsx
 *   /preview/*, /en/preview/*   X-Robots-Tag trong next.config.ts headers()
 *
 * Test khoá bất biến này: __tests__/seo/robots-noindex.test.ts
 */
export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin().replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/_internal/",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
