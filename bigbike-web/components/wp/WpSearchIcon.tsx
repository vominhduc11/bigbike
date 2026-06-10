"use client";

import { Search } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";

export function WpSearchIcon() {
  const { openPanel } = useHeaderUi();

  return (
    <div className="user-control--item search">
      <button
        onClick={() => openPanel("search")}
        // KHÔNG đặt class `search-icon`: home.min.js (theme WP) bind click handler vào
        // `header .user-control--item.search .search-icon` để toggle `header.active`
        // (vẽ vạch đen .right-header:after che nav) cho ô tìm kiếm NATIVE của theme.
        // Bản port đã thay bằng panel React (SearchToggle); nếu giữ class này thì click
        // mở panel React đồng thời bật `header.active`, mà handler đóng của theme bind
        // vào `.icon-close` (không tồn tại trong markup React) nên không bao giờ tắt lại
        // → đóng panel xong header vẫn đen, mất nav.
        className="bb-wp-search-trigger inline-flex items-center justify-center text-white bg-transparent border-none cursor-pointer"
        type="button"
        aria-label="Tìm kiếm"
      >
        <Search size={22} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
