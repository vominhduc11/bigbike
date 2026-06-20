"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MobilePdpAnchorNav, type AnchorNavItem } from "@/components/catalog/MobilePdpAnchorNav";
import { cn } from "@/lib/utils";
import { useDetachWpHandlers } from "@/lib/hooks/useDetachWpHandlers";

/** `labelKey` (key trong namespace Product.tabs) ưu tiên hơn `label` — cho phép đổi
 *  ngôn ngữ ở client; `label` là fallback (vd tab động không có key). */
export type WpTab = { id: string; label: string; labelKey?: string; content: React.ReactNode };

/** Mục neo phụ — `labelKey` (Product.tabs) ưu tiên hơn `label` để đổi ngôn ngữ. */
export type WpAnchorExtra = { id: string; label?: string; labelKey?: string };

/** Tabs sản phẩm (Mô tả / Thông số / FAQ) — DOM/class WP, toggle bằng React.
 *
 *  Đúng giao diện code CŨ (ProductTabs):
 *  • Desktop: thanh tab NGANG (.tabs-nav), chỉ panel active hiển thị.
 *  • Mobile (max-md): ẨN thanh tab ngang, xếp DỌC tất cả panel — mỗi panel có
 *    heading nhãn (chèn qua `before:content-[attr(data-label)]`) + vạch ngăn cách.
 *    Vì vậy content luôn render trong DOM; chỉ display bị CSS điều khiển theo
 *    breakpoint. Thanh nav nổi MobilePdpAnchorNav (uncontrolled) cho phép cuộn
 *    nhanh tới từng section khi khối mua (.bb-wp-pdp) đã cuộn khỏi tầm nhìn. */
export function WpProductTabs({
  tabs,
  anchorExtras = [],
}: {
  tabs: WpTab[];
  /** Mục neo phụ ngoài hệ tab (vd. section Đánh giá nằm dưới khối tab) — chỉ thêm
   *  vào thanh nav nổi mobile để cuộn nhanh tới, không tạo thêm panel tab. */
  anchorExtras?: WpAnchorExtra[];
}) {
  const tt = useTranslations("Product.tabs");
  const ttShort = useTranslations("Product.tabsShort");
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  // Cho phép mở một tab từ bên ngoài (vd. link "X đánh giá" ở khối mua hàng mở tab
  // Đánh giá). Trên desktop panel không active bị ẩn nên chỉ cuộn thôi là không đủ —
  // phải kích hoạt đúng tab trước. Component phát sự kiện rồi mới cuộn tới panel.
  useEffect(() => {
    function onActivate(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      if (tabs.some((tab) => tab.id === id)) setActive(id);
    }
    window.addEventListener("bb:pdp-activate-tab", onActivate as EventListener);
    return () => window.removeEventListener("bb:pdp-activate-tab", onActivate as EventListener);
  }, [tabs]);

  // home.min.js `wooTabs()` bind click vào `.woocommerce-tabs .tabs-nav .nav-item a` và
  // sửa class active/show imperative trên đúng panel React điều khiển bằng state → gỡ
  // handler WP, để React tự quản tab (onClick bên dưới).
  useDetachWpHandlers([
    { selector: ".woocommerce-tabs .tabs-nav .nav-item a", events: "click" },
  ]);

  if (tabs.length === 0) return null;

  // Nhãn đổi theo ngôn ngữ ở client: ưu tiên labelKey (Product.tabs), fallback label tĩnh.
  const labelOf = (item: { label?: string; labelKey?: string }) =>
    item.labelKey ? tt(item.labelKey) : item.label ?? "";
  const resolvedTabs = tabs.map((t) => ({ ...t, text: labelOf(t) }));

  // Nhãn RÚT GỌN (≤2 chữ) CHỈ cho thanh nav cuộn ở mobile — các nhãn builtin dài >2
  // chữ có bản ngắn riêng (Product.tabsShort); còn lại (đã ≤2 chữ, hoặc tab tự do) giữ
  // nhãn đầy đủ. Tiêu đề mục (H2) và tab desktop vẫn dùng nhãn đầy đủ ở `labelOf`.
  const SHORT_KEYS = new Set(["promotion", "trust"]);
  const navLabelOf = (item: { label?: string; labelKey?: string }) =>
    item.labelKey && SHORT_KEYS.has(item.labelKey) ? ttShort(item.labelKey) : labelOf(item);

  // mt-[80px]: KHÔNG dùng WP `.mt-80` (margin 80px !important ở mọi breakpoint —
  // để hở khoảng trống lớn xấu trên mobile). Dùng arbitrary để override được:
  // desktop 80px, mobile rút còn 32px + thêm vạch 3px ngăn cách section mua hàng
  // cho gọn/chuyên nghiệp (đúng cách code cũ phân tách section trên mobile).
  // mb-[40px] max-md:mb-0: KHÔNG dùng WP `.mb-40` (40px !important) — trên mobile khối tab
  // chỉ render ở đây, margin 40px của nó THẮNG margin-collapse với khoảng cách 35px (mt-10)
  // của section ngay dưới (Ưu/Nhược điểm), khiến khe trên vạch ngăn = 40px lệch nhịp 35px của
  // mọi section khác. Bỏ margin dưới trên mobile → để section dưới tự định khoảng 35px đồng đều.
  return (
    <div className="woocommerce-tabs wc-tabs-wrapper tabs mt-[80px] mb-[40px] max-md:mb-0 max-md:mt-8 max-md:border-t-[3px] max-md:border-t-border">
      {/* Thanh nav nổi mobile (khớp mockup): sticky-inline — nằm NGAY ĐẦU khối nội
          dung, hiện từ đầu, dính dưới header khi cuộn. Vì là con đầu của wrapper nên
          chỉ dính trong phạm vi khối tab (Mô tả…FAQ) rồi tự nhả sau panel cuối — không
          dính lì xuống tới "sản phẩm liên quan". Mobile xếp dọc nên bấm 1 mục = cuộn
          tới section theo id. */}
      <MobilePdpAnchorNav
        stickyInline
        items={[
          ...tabs.map((t) => ({ id: t.id, label: navLabelOf(t) })),
          ...anchorExtras.map((a): AnchorNavItem => ({ id: a.id, label: navLabelOf(a) })),
        ]}
      />
      {/* Tab nav ngang — chỉ desktop. Mobile ẩn: các panel xếp dọc bên dưới. */}
      <div className="tabs-nav max-md:hidden">
        <ul className="nav nav-tabs" role="tablist">
          {resolvedTabs.map((t) => (
            <li className="nav-item" key={t.id}>
              <a
                href={`#${t.id}`}
                id={`${t.id}-tab`}
                className={"nav-link" + (active === t.id ? " active" : "")}
                role="tab"
                aria-selected={active === t.id}
                onClick={(e) => {
                  e.preventDefault();
                  setActive(t.id);
                }}
              >
                <span data-text={t.text}>{t.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="tabs-content">
        {resolvedTabs.map((t, i) => (
          <div
            key={t.id}
            id={t.id}
            className={cn(
              "tab-panel fade wyswyg scroll-mt-[var(--bb-header-height)]",
              active === t.id && "show active",
              // Mobile: ép MỌI panel hiển thị (đè WP `.tab-panel{display:none}`),
              // chèn heading nhãn + vạch ngăn cách phía trên như code cũ.
              // pt-6 (KHÔNG py-6): chỉ chừa khoảng TRÊN tách nhãn khỏi vạch ngăn; BỎ khoảng dưới
              // để panel cuối (vd Đánh giá) không đẩy khe xuống dài hơn vạch ngăn của section kế.
              "max-md:!block max-md:pt-6 max-md:scroll-mt-[calc(var(--bb-header-height)_+_52px)]",
              "max-md:border-t-[3px] max-md:border-t-border max-md:first:[border-top:none]",
            )}
            role="tabpanel"
            aria-labelledby={`${t.id}-tab`}
          >
            {/* Heading nhãn section = H2 THẬT (thay CSS `::before` cũ — screen
                reader & bot không đọc được pseudo-content). Chỉ hiện ở mobile
                (md:hidden): desktop dùng thanh tab ngang làm nhãn. Google index
                mobile-first nên H2 này luôn được nhìn thấy. `!mb-4` đè
                `.wyswyg h2{margin-bottom:30px}` để giữ đúng khoảng cách cũ. */}
            <h2 className="md:hidden !mb-4 flex items-center gap-2.5 font-body text-lg font-semibold text-[var(--bb-text-primary)] uppercase leading-[1.2]">
              {/* Số thứ tự mục (01–05) — CHỈ mobile, khớp mockup. Ô đỏ brand, chữ
                  trắng, font heading (Oswald) cho cảm giác số "display". */}
              <span className="inline-flex shrink-0 items-center justify-center bg-brand px-1.5 py-0.5 font-heading text-xs font-bold leading-none text-white tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              {t.text}
            </h2>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}
