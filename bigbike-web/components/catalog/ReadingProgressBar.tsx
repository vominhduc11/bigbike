"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Vạch tiến độ đọc (khớp mockup PDP mobile): một vạch mảnh màu brand chạy ngang
 * sát mép trên màn hình, độ rộng = % đã cuộn của cả trang. CHỈ mobile (md:hidden);
 * desktop không cần.
 *
 * Render qua PORTAL ra thẳng `document.body`: nếu để trong cây nội dung, vạch bị
 * "nhốt" trong stacking context của trang và bị HEADER (z-index:10, nhánh DOM khác)
 * vẽ ĐÈ lên dù z-index có cao hơn — đó là lý do trước đây không nhìn thấy. Ra body
 * thì nó là con trực tiếp của body, z-[100] thắng header. Mount-gate để không gọi
 * portal lúc SSR (chưa có document.body) → tránh lệch hydrate.
 *
 * Thuần trang trí nên aria-hidden + pointer-events-none để không chặn thao tác chạm.
 * Throttle bằng requestAnimationFrame; tôn trọng prefers-reduced-motion.
 */
export function ReadingProgressBar() {
  const [pct, setPct] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-gate cho portal SSR-safe
    setMounted(true);
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setPct(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    // z-[210]: header WP (header.headroom) thực tế là z-index:200 — vạch PHẢI cao hơn
    // mới không bị header đen che. h-[3px] cho dễ thấy. Nằm sát mép trên cùng.
    <div
      aria-hidden
      className="md:hidden fixed top-0 left-0 right-0 z-[210] h-[3px] bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-brand transition-[width] duration-100 ease-linear motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>,
    document.body,
  );
}
