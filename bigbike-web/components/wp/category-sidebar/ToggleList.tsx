"use client";

import { Children, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";

/**
 * Danh sách lọc có "Xem thêm" — port React của theme JS `sideBarToggle`
 * (home.min.js chỉ chạy 1 lần lúc full-load, KHÔNG chạy lại khi điều hướng nội bộ
 * SPA → tự dựng lại bằng React cho ổn định mọi lúc).
 *
 * Khi thu gọn chỉ render đúng 10 mục: theme JS chỉ tác động khi ul có > 10 <li>,
 * nên nó sẽ bỏ qua ul này và KHÔNG chèn nút trùng. Clamp + nút dùng đúng class
 * `visible`/`show-more` đã có trong wp-theme-category.css/wp-theme-product.css.
 */
export function ToggleList({
  className,
  children,
  collapseAt = 10,
}: {
  className?: string;
  children: React.ReactNode;
  collapseAt?: number;
}) {
  const t = useTranslations("Catalog");
  const [expanded, setExpanded] = useState(false);
  // Khi thu gọn vẫn giữ đủ <li> trong lúc chạy hiệu ứng (mới co lại được); cắt bớt
  // sau khi animation xong. `collapsing=true` = đang co nhưng chưa cắt.
  const [collapsing, setCollapsing] = useState(false);
  const ulRef = useRef<HTMLUListElement>(null);
  // Chiều cao đo được NGAY TRƯỚC khi đổi expanded, để useLayoutEffect animate từ đó.
  const fromHeight = useRef<number | null>(null);
  const items = Children.toArray(children);
  // collapseAt ≤ 10 để theme JS (chỉ tác động khi ul > 10 <li>) bỏ qua, tránh nút trùng.
  const hasMore = items.length > collapseAt;
  // Cắt bớt chỉ khi đã thu gọn HẲN (không mở, không đang co). `.visible` (clamp+fade)
  // cũng chỉ áp ở trạng thái nghỉ này.
  const collapsedRest = hasMore && !expanded && !collapsing;
  const visibleItems = collapsedRest ? items.slice(0, collapseAt) : items;

  // Slide mượt max-height. Mở: từ chiều cao cũ → scrollHeight đầy đủ. Thu gọn: giữ đủ
  // <li> (collapsing), animate về chiều cao của `collapseAt` mục đầu, xong mới cắt.
  useLayoutEffect(() => {
    const el = ulRef.current;
    if (!el || fromHeight.current == null) return;
    const from = fromHeight.current;
    fromHeight.current = null;
    let to: number;
    if (expanded) {
      to = el.scrollHeight;
    } else {
      // Đang giữ đủ <li>: mốc thu gọn = đỉnh của <li> thứ collapseAt so với ul.
      const cut = el.children[collapseAt] as HTMLElement | undefined;
      to = cut ? cut.getBoundingClientRect().top - el.getBoundingClientRect().top : el.scrollHeight;
    }
    el.style.overflow = "hidden";
    el.style.maxHeight = `${from}px`;
    el.getBoundingClientRect(); // ép reflow để trình duyệt ghi nhận mốc đầu
    el.style.transition = "max-height 0.3s ease";
    el.style.maxHeight = `${to}px`;
    const cleanup = () => {
      el.removeEventListener("transitionend", cleanup);
      el.style.transition = "";
      if (expanded) {
        el.style.maxHeight = "";
        el.style.overflow = "";
      } else {
        // Cắt <li> trước (giữ inline maxHeight để không giật về chiều cao đầy đủ).
        setCollapsing(false);
      }
    };
    el.addEventListener("transitionend", cleanup);
    return () => el.removeEventListener("transitionend", cleanup);
  }, [expanded, collapseAt]);

  // Sau khi đã cắt bớt <li> (collapsing → false), xoá inline style để trả về CSS gốc
  // (`.visible` clamp 400 + fade). Lúc này nội dung đã đúng chiều cao nên không giật.
  useLayoutEffect(() => {
    if (collapsing) return;
    const el = ulRef.current;
    if (!el) return;
    el.style.maxHeight = "";
    el.style.overflow = "";
    el.style.transition = "";
  }, [collapsing]);

  function toggle() {
    fromHeight.current = ulRef.current?.getBoundingClientRect().height ?? null;
    if (expanded) setCollapsing(true); // giữ đủ <li> để animate co lại
    setExpanded((v) => !v);
  }

  return (
    <>
      <ul ref={ulRef} className={`${className ?? ""}${collapsedRest ? " visible" : ""}`}>
        {visibleItems}
      </ul>
      {hasMore && (
        // KHÔNG dùng class `show-more`: home.min.js bind $('.show-more').on('click')
        // (ẩn nút + bỏ visible) vào mọi .show-more khi full-load, phá nút React. Dùng
        // Tailwind cùng kiểu dáng (.widget--body .show-more gốc) để theme JS không bắt được.
        <div
          className="h-[52px] cursor-pointer border border-black bg-black px-2.5 text-center font-semibold uppercase leading-[52px] text-white"
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle()}
        >
          {expanded ? t("showLess") : t("showMore")}
          {expanded ? (
            <Minus className="ml-2.5 inline-block align-middle" size={16} aria-hidden />
          ) : (
            <Plus className="ml-2.5 inline-block align-middle" size={16} aria-hidden />
          )}
        </div>
      )}
    </>
  );
}
