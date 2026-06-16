"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  /** Sticky-inline mode (khớp mockup): thanh nằm TRONG dòng chảy ngay đầu khối nội
   *  dung, LUÔN hiện từ đầu, dùng `position: sticky` để dính dưới header khi cuộn —
   *  thay vì kiểu `fixed` ẩn-rồi-trượt-vào. Bỏ qua observer trigger hiện/ẩn. */
  stickyInline?: boolean;
};

export function MobilePdpAnchorNav({
  items,
  triggerSelector = ".bb-wp-pdp-layout",
  activeId: controlledActiveId,
  onSelect,
  scrollTargetSelector,
  headerSelector = "header.headroom",
  stickyInline = false,
}: Props) {
  const t = useTranslations("A11y");
  const controlled = typeof onSelect === "function";
  const [internalActive, setInternalActive] = useState(items[0]?.id ?? "");
  const activeId = controlled ? (controlledActiveId ?? items[0]?.id ?? "") : internalActive;
  const [visible, setVisible] = useState(false);
  // Sticky-inline luôn hiện; mặc định (fixed) hiện theo observer trigger. Suy ra từ
  // prop thay vì setState trong effect (tránh cascading render).
  const shown = stickyInline || visible;
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

  // Sticky-inline: luôn hiện ngay từ đầu (khớp mockup) — bỏ qua observer trigger.
  // Mặc định (fixed): hiện thanh nav khi element trigger cuộn khỏi tầm nhìn (lên trên).
  useEffect(() => {
    if (stickyInline) return;
    const trigger = document.querySelector<HTMLElement>(triggerSelector);
    if (!trigger) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry ? !entry.isIntersecting : false),
      { threshold: 0 },
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [triggerSelector, stickyInline]);

  // Bám mép dưới header WP thật (cao ~80px ≠ --bb-header-height 60px, lại co/giãn
  // theo headroom) để thanh nằm SÁT DƯỚI header, không đè lên. CHỈ bám khi thanh
  // đang HIỆN: lúc ẩn (cuộn lên), header headroom trượt xuống hiện lại nên mép dưới
  // của nó tăng dần 0→80px — nếu vẫn bám, topPx kéo thanh ĐI XUỐNG đúng lúc nó đang
  // trượt-lên/fade để ẩn → hai chiều ngược nhau → GIẬT. Vì vậy `visible=false` thì
  // ngừng cập nhật, để thanh trượt thẳng lên gọn từ vị trí đã ghim. Đo lại ngay mỗi
  // khi `visible` đổi (đưa vào deps) để khi hiện ra đã đúng vị trí, không nhấp nháy.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(headerSelector);
    if (!header) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      setTopPx(Math.max(0, Math.round(header.getBoundingClientRect().bottom)));
    };
    const onScroll = () => {
      if (!shown) return; // đang ẩn → đóng băng top, không để header kéo thanh lệch khi biến mất
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
  }, [headerSelector, shown]);

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

    const headerEl =
      document.querySelector<HTMLElement>(headerSelector) ??
      document.querySelector<HTMLElement>(".bb-site-header");
    const offset = (headerEl?.offsetHeight ?? 60) + (navRef.current?.offsetHeight ?? 44) + 8;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <nav
      ref={navRef}
      // `flex flex-nowrap whitespace-nowrap`: KHÓA MỘT-HÀNG ở CẢ cấp thanh chứa, không chỉ
      // trên từng nút. Khi nhiều mục dài hơn bề ngang (4 mục tiếng Việt trên màn mobile hẹp),
      // thanh phải CUỘN NGANG một dòng — KHÔNG xuống dòng. `flex-nowrap` chặn wrap ở chế độ
      // flex; `whitespace-nowrap` ở thanh chứa là lớp phòng hờ: nếu `display:flex` thua cascade
      // Tailwind v4 (đúng lỗi đã gặp bên dưới) → nút rơi về inline-block, lúc đó chính
      // `whitespace-nowrap` giữ chúng trên một dòng để `overflow-x-auto` cuộn, thay vì tràn xuống.
      // `flex md:!hidden` (không `hidden max-md:flex`) để tránh lỗi cascade Tailwind v4
      // khiến `hidden` thắng → thanh kẹt display:none. `!hidden` (important) ở md để ép
      // ẩn HẲN trên desktop — nếu chỉ `md:hidden` thì `flex` có thể thắng cascade và thanh
      // lọt ra desktop (chỉ được phép xuất hiện ở mobile). `top` đặt runtime bằng mép dưới
      // header thật (style inline), CSS var chỉ là fallback frame đầu. Hiệu ứng reveal:
      // thanh TRƯỢT XUỐNG TỪ SAU HEADER (-translate-y-full → 0) kèm fade. Header WP là nền
      // ĐEN ĐẶC, z-index:10 (xem `header{…z-index:10}` trong app/globals.css + wp-theme-*.css)
      // → thanh PHẢI có z THẤP HƠN 10 (đặt `z-[9]`) để chui SAU header và bị header che kín
      // khi trượt. Trước đây để `z-40` (cao hơn header) nên thanh ĐÈ LÊN header, lúc trượt/
      // lúc header headroom đang slide thì hở ra cảnh chồng chữ lên logo/menu — KHÔNG dùng lại.
      // z-[9] vẫn nổi trên nội dung trang (nội dung không tạo stacking context cao).
      // Easing ease-out-expo (cubic-bezier .16,1,.3,1) giảm tốc mượt, 300ms; will-change
      // để GPU lo transform. Lúc ẩn dùng pointer-events-none để không chặn tương tác bên
      // dưới. Tôn trọng prefers-reduced-motion (tắt transition → hiện tức thì, không trượt).
      className={cn(
        "flex flex-nowrap whitespace-nowrap md:!hidden top-[var(--bb-header-height)] z-[9]",
        "overflow-x-auto overflow-y-hidden [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "bg-white border-b border-border px-2 gap-0 shadow-[0_4px_12px_-6px_rgba(0,0,0,0.25)]",
        stickyInline
          // Sticky-inline (mockup): dính trong dòng chảy, luôn hiện, không reveal.
          ? "sticky"
          // Mặc định (fixed): trượt-vào từ sau header kèm fade, ẩn cho tới khi trigger cuộn qua.
          : cn(
              "fixed left-0 right-0",
              "transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none",
              visible
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 -translate-y-full pointer-events-none",
            ),
      )}
      style={topPx != null ? { top: topPx } : undefined}
      aria-label={t("productContentNav")}
      aria-hidden={!shown}
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
          tabIndex={shown ? 0 : -1}
          aria-current={activeId === item.id ? "location" : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
