"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MobilePdpAnchorNav, type AnchorNavItem } from "@/components/catalog/MobilePdpAnchorNav";
import { cn } from "@/lib/utils";

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
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  if (tabs.length === 0) return null;

  // Nhãn đổi theo ngôn ngữ ở client: ưu tiên labelKey (Product.tabs), fallback label tĩnh.
  const labelOf = (item: { label?: string; labelKey?: string }) =>
    item.labelKey ? tt(item.labelKey) : item.label ?? "";
  const resolvedTabs = tabs.map((t) => ({ ...t, text: labelOf(t) }));

  // mt-[80px]: KHÔNG dùng WP `.mt-80` (margin 80px !important ở mọi breakpoint —
  // để hở khoảng trống lớn xấu trên mobile). Dùng arbitrary để override được:
  // desktop 80px, mobile rút còn 32px + thêm vạch 3px ngăn cách section mua hàng
  // cho gọn/chuyên nghiệp (đúng cách code cũ phân tách section trên mobile).
  return (
    <div className="woocommerce-tabs wc-tabs-wrapper tabs mt-[80px] mb-40 max-md:mt-8 max-md:border-t-[3px] max-md:border-t-border">
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
        {resolvedTabs.map((t) => (
          <div
            key={t.id}
            id={t.id}
            className={cn(
              "tab-panel fade wyswyg",
              active === t.id && "show active",
              // Mobile: ép MỌI panel hiển thị (đè WP `.tab-panel{display:none}`),
              // chèn heading nhãn + vạch ngăn cách phía trên như code cũ.
              "max-md:!block max-md:pt-6 max-md:pb-1 max-md:scroll-mt-[calc(var(--bb-header-height)_+_52px)]",
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
            <h2 className="md:hidden !mb-4 font-body text-lg font-semibold text-[var(--bb-text-primary)] uppercase leading-[1.2]">
              {t.text}
            </h2>
            {t.content}
          </div>
        ))}
      </div>

      {/* Thanh nav nổi mobile: uncontrolled — cuộn tới section theo id (mobile xếp
          dọc nên không còn "đổi tab", chỉ scroll-to-section như code cũ). Mục đầu
          "Tổng quan" trỏ về khối mua hàng (#pdp-overview) — giống code cũ. */}
      <MobilePdpAnchorNav
        items={[
          { id: "pdp-overview", label: tt("overview") },
          ...resolvedTabs.map((t) => ({ id: t.id, label: t.text })),
          ...anchorExtras.map((a): AnchorNavItem => ({ id: a.id, label: labelOf(a) })),
        ]}
        triggerSelector=".bb-wp-pdp"
      />
    </div>
  );
}
