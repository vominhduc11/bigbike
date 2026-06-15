"use client";

import { useEffect } from "react";

// Khi admin bấm "Xem trên web" ở màn Cài đặt, link mở trang kèm hash #bbf=<sectionId>.
// Component này cuộn tới khối [data-bb-focus~="sectionId"] tương ứng và nháy viền làm nổi bật,
// giúp admin thấy ngay ô vừa chỉnh nằm ở đâu trên web — không cần nhúng iframe (storefront chặn
// iframe bằng X-Frame-Options/frame-ancestors để chống clickjacking).
export function SettingsFocusScroller() {
  useEffect(() => {
    function run() {
      const match = window.location.hash.match(/bbf=([a-z0-9_]+)/i);
      if (!match) return;
      const id = match[1];
      let tries = 0;
      const tryFocus = () => {
        const el = document.querySelector(`[data-bb-focus~="${id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("bb-focus-flash");
          window.setTimeout(() => el.classList.remove("bb-focus-flash"), 2400);
          // Xoá hash để F5 thủ công không kích hoạt lại.
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          return;
        }
        // Khối có thể render trễ (dữ liệu client / carousel) → thử lại tối đa ~5s.
        if (tries++ < 20) window.setTimeout(tryFocus, 250);
      };
      tryFocus();
    }
    run();
    window.addEventListener("hashchange", run);
    return () => window.removeEventListener("hashchange", run);
  }, []);
  return null;
}
