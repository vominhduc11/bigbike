"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export type ProductTabSection = {
  id: string;
  label: string;
  content: ReactNode;
};

function toWpTabButtonId(id: string) {
  return id.startsWith("tab-") ? `${id.slice(4)}-tab` : `${id}-tab`;
}

export function ProductTabs({ sections }: { sections: ProductTabSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  if (sections.length === 0) return null;
  const activeId = sections.some((section) => section.id === active)
    ? active
    : sections[0].id;

  return (
    <section className="woocommerce-tabs wc-tabs-wrapper tabs mt-80 mb-40 bb-wp-tabs">
      <div className="tabs-nav" role="tablist" aria-label="Thông tin sản phẩm">
        <ul className="nav nav-tabs" id="myTab">
          {sections.map((section) => {
            const tabId = toWpTabButtonId(section.id);
            return (
              <li key={section.id} className="nav-item">
                <a
                  role="tab"
                  aria-selected={activeId === section.id}
                  aria-controls={section.id}
                  id={tabId}
                  href={`#${section.id}`}
                  className={`nav-link${activeId === section.id ? " active" : ""}`}
                  onClick={(event) => {
                    event.preventDefault();
                    setActive(section.id);
                  }}
                >
                  <span data-text={section.label}>{section.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="tabs-content">
        {sections.map((section) => (
          <div
            key={section.id}
            id={section.id}
            role="tabpanel"
            aria-labelledby={toWpTabButtonId(section.id)}
            className={`tab-panel fade wyswyg${activeId === section.id ? " show active" : ""}`}
            data-label={section.label}
            hidden={activeId !== section.id}
          >
            {section.content}
          </div>
        ))}
      </div>
    </section>
  );
}
