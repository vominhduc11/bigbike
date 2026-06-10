"use client";

import { useState } from "react";
import { MobilePdpAnchorNav } from "@/components/catalog/MobilePdpAnchorNav";

export type WpTab = { id: string; label: string; content: React.ReactNode };

/** Tabs WooCommerce (Mô tả / Videos / Thông số) — DOM/class WP, toggle bằng React.
 *  Trên mobile, khi khối mua (.bb-wp-pdp) cuộn khỏi tầm nhìn, hiện lại thanh nav nổi
 *  dưới header — TÁI SỬ DỤNG MobilePdpAnchorNav (đúng giao diện code cũ) ở controlled
 *  mode: bấm 1 mục = đổi tab + cuộn vùng tab về dưới header. */
export function WpProductTabs({ tabs }: { tabs: WpTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  if (tabs.length === 0) return null;

  return (
    <div className="woocommerce-tabs wc-tabs-wrapper tabs mt-80 mb-40">
      <div className="tabs-nav">
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
            className={"tab-panel fade wyswyg" + (active === t.id ? " show active" : "")}
            role="tabpanel"
            aria-labelledby={t.id}
          >
            {active === t.id ? t.content : null}
          </div>
        ))}
      </div>

      <MobilePdpAnchorNav
        items={tabs.map((t) => ({ id: t.id, label: t.label }))}
        activeId={active}
        onSelect={setActive}
        triggerSelector=".bb-wp-pdp"
        scrollTargetSelector=".woocommerce-tabs"
      />
    </div>
  );
}
