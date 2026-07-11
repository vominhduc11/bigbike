"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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
  return (
    path === "/gio-hang" ||
    path === "/dat-hang" ||
    path.startsWith("/product/")
  );
}

export function FooterMobileGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideOnMobile = isHiddenOnMobile(pathname ?? "");

  return <div className={hideOnMobile ? "hidden md:block" : undefined}>{children}</div>;
}
