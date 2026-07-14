"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";

const SHOW_AFTER_PX = 560;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Nút "cuộn lên đầu trang" — FAB tròn, cố định góc phải màn hình, nằm ngay
// TRÊN nút chat (bb-scroll-top-anchor mirror các rule show/hide/lift của
// bb-floating-chat-anchor trong globals.css) và chỉ hiện khi đã cuộn xuống,
// tránh chồng lên popup chat khi mở (2 anchor tách biệt, không dùng chung
// flex layout nên vị trí không phụ thuộc trạng thái đóng/mở của nhau).
// z-index CAO HƠN bb-floating-chat-anchor (665 > 663): vòng hào quang nhấp
// nháy quanh nút chat giãn ra ngoài kích thước nút một khoảng, nếu thấp hơn
// sẽ bị hào quang đó vẽ đè lên — nút cuộn-lên-đầu-trang phải luôn hiện rõ.
export function ScrollToTopFab() {
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
      className="bb-scroll-top-anchor fixed z-[665] bottom-[calc(var(--bb-mobile-nav-height)+env(safe-area-inset-bottom)+144px)] right-[max(16px,env(safe-area-inset-right))] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none md:bottom-[calc(max(24px,env(safe-area-inset-bottom))+102px)] md:right-[max(24px,env(safe-area-inset-right))] [[data-scroll-locked]_&]:hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <Button
        type="button"
        variant="primary"
        size="icon"
        aria-label="Cuộn lên đầu trang"
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        onClick={scrollToTop}
        className="rounded-full bg-brand-on-dark text-white shadow-[0_4px_16px_rgba(0,0,0,0.22)] hover:bg-brand-hover hover:not-disabled:scale-100"
      >
        <ChevronUp className="h-5 w-5" aria-hidden />
      </Button>
    </div>
  );
}
