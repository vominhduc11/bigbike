"use client";

import { useState } from "react";
import { MobilePdpAnchorNav, type AnchorNavItem } from "@/components/catalog/MobilePdpAnchorNav";
import { cn } from "@/lib/utils";

export type WpTab = { id: string; label: string; content: React.ReactNode };

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
  anchorExtras?: AnchorNavItem[];
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  if (tabs.length === 0) return null;

  // mt-[80px]: KHÔNG dùng WP `.mt-80` (margin 80px !important ở mọi breakpoint —
  // để hở khoảng trống lớn xấu trên mobile). Dùng arbitrary để override được:
  // desktop 80px, mobile rút còn 32px + thêm vạch 3px ngăn cách section mua hàng
  // cho gọn/chuyên nghiệp (đúng cách code cũ phân tách section trên mobile).
  return (
    <div className="woocommerce-tabs wc-tabs-wrapper tabs mt-[80px] mb-40 max-md:mt-8 max-md:border-t-[3px] max-md:border-t-border">
      {/* Tab nav ngang — chỉ desktop. Mobile ẩn: các panel xếp dọc bên dưới. */}
      <div className="tabs-nav max-md:hidden">
        <ul className="nav nav-tabs" role="tablist">
          {tabs.map((t) => (
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
                <span data-text={t.label}>{t.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="tabs-content">
        {tabs.map((t) => (
          <div
            key={t.id}
            id={t.id}
            data-label={t.label}
            className={cn(
              "tab-panel fade wyswyg",
              active === t.id && "show active",
              // Mobile: ép MỌI panel hiển thị (đè WP `.tab-panel{display:none}`),
              // chèn heading nhãn + vạch ngăn cách phía trên như code cũ.
              "max-md:!block max-md:pt-6 max-md:pb-1 max-md:scroll-mt-[calc(var(--bb-header-height)_+_52px)]",
              "max-md:border-t-[3px] max-md:border-t-border max-md:first:[border-top:none]",
              "max-md:before:content-[attr(data-label)] max-md:before:block max-md:before:mb-4 max-md:before:font-body max-md:before:text-lg max-md:before:font-semibold max-md:before:text-[var(--bb-text-primary)] max-md:before:uppercase max-md:before:leading-[1.2]",
            )}
            role="tabpanel"
            aria-labelledby={`${t.id}-tab`}
          >
            {t.content}
          </div>
        ))}
      </div>

      {/* Thanh nav nổi mobile: uncontrolled — cuộn tới section theo id (mobile xếp
          dọc nên không còn "đổi tab", chỉ scroll-to-section như code cũ). Mục đầu
          "Tổng quan" trỏ về khối mua hàng (#pdp-overview) — giống code cũ. */}
      <MobilePdpAnchorNav
        items={[
          { id: "pdp-overview", label: "Tổng quan" },
          ...tabs.map((t) => ({ id: t.id, label: t.label })),
          ...anchorExtras,
        ]}
        triggerSelector=".bb-wp-pdp"
      />
    </div>
  );
}
