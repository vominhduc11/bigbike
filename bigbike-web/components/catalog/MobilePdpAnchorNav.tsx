"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type AnchorNavItem = {
  id: string;
  label: string;
};

type Props = {
  items: AnchorNavItem[];
  /** Element mà khi nó cuộn khỏi tầm nhìn (lên trên) thì hiện thanh nav. Mặc định
   *  khối mua của layout cũ; trang WP (tab) truyền ".bb-wp-pdp". Đặt phần tử ở ĐẦU
   *  trang để tránh hiện nhầm lúc tải (lúc đó nó còn trong viewport → ẩn). */
  triggerSelector?: string;
  /** Controlled mode (layout tab WP): cha giữ active + xử lý chọn. Khi truyền
   *  onSelect → bỏ qua observer active-theo-section và scroll-tới-section nội bộ,
   *  chỉ gọi onSelect(id) + cuộn tới scrollTargetSelector. */
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Nơi cuộn tới khi bấm 1 mục ở controlled mode (mặc định = triggerSelector). */
  scrollTargetSelector?: string;
  /** Header để bám mép dưới (đo runtime). Mặc định header WP. */
  headerSelector?: string;
};

export function MobilePdpAnchorNav({
  items,
  triggerSelector = ".bb-wp-pdp-layout",
  activeId: controlledActiveId,
  onSelect,
  scrollTargetSelector,
  headerSelector = "header.headroom",
}: Props) {
  const controlled = typeof onSelect === "function";
  const [internalActive, setInternalActive] = useState(items[0]?.id ?? "");
  const activeId = controlled ? (controlledActiveId ?? items[0]?.id ?? "") : internalActive;
  const [visible, setVisible] = useState(false);
  // Mép trên thanh = mép DƯỚI header thật (đo runtime), null = chưa đo → dùng fallback CSS.
  const [topPx, setTopPx] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const manualRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollNavToActive = useCallback((id: string) => {
    const nav = navRef.current;
    if (!nav) return;
    const btn = nav.querySelector<HTMLElement>(`[data-id="${id}"]`);
    btn?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, []);

  // Hiện thanh nav khi element trigger cuộn khỏi tầm nhìn (lên trên).
  useEffect(() => {
    const trigger = document.querySelector<HTMLElement>(triggerSelector);
    if (!trigger) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry ? !entry.isIntersecting : false),
      { threshold: 0 },
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [triggerSelector]);

  // Bám mép dưới header WP thật (cao ~80px ≠ --bb-header-height 60px, lại co/giãn
  // theo headroom) để thanh nằm SÁT DƯỚI header, không đè lên. Đo LIÊN TỤC (kể cả
  // lúc thanh đang ẩn) để khi hiện ra đã đúng vị trí ngay, không nhảy/nhấp nháy.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(headerSelector);
    if (!header) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      setTopPx(Math.max(0, Math.round(header.getBoundingClientRect().bottom)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [headerSelector]);

  // Uncontrolled: theo dõi section đang xem để tô đậm. Controlled thì cha lo state.
  useEffect(() => {
    if (controlled || items.length === 0) return;

    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (manualRef.current) return;
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis.length > 0) {
          const id = vis[0].target.id;
          setInternalActive(id);
          scrollNavToActive(id);
        }
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    for (const el of elements) observer.observe(el);

    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [controlled, items, scrollNavToActive]);

  function handleClick(id: string) {
    scrollNavToActive(id);

    // Controlled (tab WP): đổi tab + cuộn vùng tab về dưới header.
    if (controlled) {
      onSelect!(id);
      const target = document.querySelector<HTMLElement>(scrollTargetSelector ?? triggerSelector);
      if (target) {
        const offset = 60 + (navRef.current?.offsetHeight ?? 44) + 8;
        const y = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }
      return;
    }

    // Uncontrolled (layout cũ): cuộn tới section theo id.
    const el = document.getElementById(id);
    if (!el) return;

    manualRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      manualRef.current = false;
    }, 800);
    setInternalActive(id);

    const headerEl = document.querySelector<HTMLElement>(".bb-site-header");
    const offset = (headerEl?.offsetHeight ?? 60) + (navRef.current?.offsetHeight ?? 44) + 8;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <nav
      ref={navRef}
      // `flex md:hidden` (không `hidden max-md:flex`) để tránh lỗi cascade Tailwind v4
      // khiến `hidden` thắng → thanh kẹt display:none. `top` đặt runtime bằng mép dưới
      // header thật (style inline), CSS var chỉ là fallback frame đầu. Ẩn/hiện TỨC
      // THÌ bằng visibility — KHÔNG transition/translate, để hiện ngay dưới header,
      // không trượt từ trên xuống.
      className={cn(
        "flex md:hidden fixed top-[var(--bb-header-height)] left-0 right-0 z-40",
        "overflow-x-auto overflow-y-hidden [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "bg-white border-b border-border px-2 gap-0",
        visible ? "visible pointer-events-auto" : "invisible pointer-events-none",
      )}
      style={topPx != null ? { top: topPx } : undefined}
      aria-label="Điều hướng nội dung sản phẩm"
      aria-hidden={!visible}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-id={item.id}
          className={cn(
            "flex-none [scroll-snap-align:start] py-2.5 px-3.5 border-b-2 bg-transparent",
            "font-body text-xs font-bold uppercase tracking-normal whitespace-nowrap cursor-pointer -mb-px min-h-11",
            activeId === item.id
              ? "text-brand border-b-brand"
              : "text-muted-foreground border-b-transparent",
          )}
          onClick={() => handleClick(item.id)}
          tabIndex={visible ? 0 : -1}
          aria-current={activeId === item.id ? "location" : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
