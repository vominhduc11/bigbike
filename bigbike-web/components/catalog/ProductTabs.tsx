"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export type ProductTabSection = {
  /** Stable anchor id for the section. */
  id: string;
  /** Tab button text (also the section's descriptive title). */
  label: string;
  /** Rendered panel body. */
  content: ReactNode;
};

export function ProductTabs({ sections }: { sections: ProductTabSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  if (sections.length === 0) return null;

  return (
    <section className="mx-auto mt-14 max-w-[1440px] px-4 sm:px-6">
      <nav className="bb-product-tabs-nav" role="tablist" aria-label="Thông tin sản phẩm">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active === section.id}
            aria-controls={`bb-tab-panel-${section.id}`}
            id={`bb-tab-${section.id}`}
            className={`bb-product-tab-btn${active === section.id ? " active" : ""}`}
            onClick={() => setActive(section.id)}
          >
            <span>{section.label}</span>
          </button>
        ))}
      </nav>
      {sections.map((section) => (
        <div
          key={section.id}
          id={`bb-tab-panel-${section.id}`}
          role="tabpanel"
          aria-labelledby={`bb-tab-${section.id}`}
          className={`bb-product-tab-panel${active === section.id ? " active" : ""}`}
        >
          <div className="py-8">{section.content}</div>
        </div>
      ))}
    </section>
  );
}
