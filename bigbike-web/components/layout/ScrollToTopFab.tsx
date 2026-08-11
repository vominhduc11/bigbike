"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

const SHOW_AFTER_PX = 560;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Nút "cuộn lên đầu trang" là thao tác phụ, đặt cao hơn nút chat và vòng halo.
// Vị trí tách khỏi chat để không cạnh tranh với nút hỗ trợ chính ở góc phải.
export function ScrollToTopFab() {
  const t = useTranslations("Common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    const reduceMotion = window.matchMedia?.(REDUCED_MOTION_QUERY).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <div
      className="bb-scroll-top-anchor fixed z-[var(--bb-z-scroll-top)] transition-opacity duration-200 ease-out motion-reduce:transition-none [[data-scroll-locked]_&]:hidden"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <Button
        type="button"
        variant="primary"
        size="icon"
        aria-label={t("scrollToTop")}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        onClick={scrollToTop}
        // border-brand-on-dark khớp với nền đỏ sáng: border-primary của variant là đỏ sẫm hơn
        // nên để mặc định sẽ tạo viền lệch màu quanh nút lúc nghỉ.
        // Dùng chung --bb-shadow-lg với nút chat để cả cụm nút nổi cùng một độ cao bóng đổ.
        className="size-11 rounded-none border-brand-on-dark bg-brand-on-dark text-white shadow-[var(--bb-shadow-lg)] hover:not-disabled:scale-100"
      >
        <ChevronUp className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
