"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { FooterMenuLinks } from "@/components/layout/FooterMenuLinks";
import { translatePath } from "@/lib/utils/routes";

/**
 * Ẩn footer TRÊN MOBILE ở các trang "thao tác mua hàng" (giỏ hàng, đặt hàng/thanh
 * toán, chi tiết sản phẩm) để màn hình nhỏ gọn gàng, tập trung vào nút hành động
 * (các trang chi tiết sản phẩm còn có thanh mua hàng dính đáy). Desktop (≥768px)
 * luôn hiện footer ở MỌI trang như bình thường — `md:block` ghi đè `hidden`.
 *
 * Chỉ bọc bằng 1 <div> trung tính; footer tự giữ z-index/positioning riêng nên
 * lớp bọc không ảnh hưởng layout hay các selector `[data-footer-content]`.
 */
function isHiddenOnMobile(pathname: string): boolean {
  // `trailingSlash: true` (next.config) nên bỏ dấu "/" cuối trước khi so khớp.
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/gio-hang" || path === "/dat-hang" || path.startsWith("/product/");
}

function isCredentialRoute(pathname: string): boolean {
  const path = translatePath(pathname, "vi").replace(/\/+$/, "") || "/";
  return path === "/dang-nhap" || path === "/dang-ky";
}

export function FooterMobileGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideOnMobile = isHiddenOnMobile(pathname ?? "");

  if (isCredentialRoute(pathname ?? "")) {
    return (
      <footer data-bb-auth-footer className="bg-footer-top text-white">
        <Container variant="blog" className="px-4! py-3!">
          <FooterMenuLinks variant="privacy" />
        </Container>
      </footer>
    );
  }

  return <div className={hideOnMobile ? "hidden md:block" : undefined}>{children}</div>;
}
