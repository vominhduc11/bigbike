"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export type ProductTabSection = {
  id: string;
  label: string;
  content: ReactNode;
};

export function ProductTabs({ sections }: { sections: ProductTabSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  if (sections.length === 0) return null;
  const activeId = sections.some((section) => section.id === active)
    ? active
    : sections[0].id;

  return (
    <section className="woocommerce-tabs wc-tabs-wrapper tabs mt-80 mb-40 bb-wp-tabs">
      <div className="tabs-nav" role="tablist" aria-label="Thông tin sản phẩm">
        <ul className="nav nav-tabs">
          {sections.map((section) => (
            <li key={section.id} className="nav-item">
              <button
                type="button"
                role="tab"
                aria-selected={activeId === section.id}
                aria-controls={`bb-tab-panel-${section.id}`}
                id={`bb-tab-${section.id}`}
                className={`nav-link${activeId === section.id ? " active" : ""}`}
                onClick={() => setActive(section.id)}
              >
                <span>{section.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="tab-content">
        {sections.map((section) => (
          <div
            key={section.id}
            id={`bb-tab-panel-${section.id}`}
            role="tabpanel"
            aria-labelledby={`bb-tab-${section.id}`}
            className={`tab-pane fade wyswyg${activeId === section.id ? " show active" : ""}`}
            hidden={activeId !== section.id}
          >
            {section.content}
          </div>
        ))}
      </div>
    </section>
  );
}
