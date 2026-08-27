import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CatalogSidebar } from "@/components/catalog/CatalogSidebar";
import type { CatalogFacets } from "@/lib/contracts/public";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { count?: number }) => values?.count == null ? key : `${key} ${values.count}`,
}));

/* eslint-disable @next/next/no-img-element */
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img {...props} alt={String(props.alt ?? "")} />,
}));
/* eslint-enable @next/next/no-img-element */

const facets: CatalogFacets = {
  categories: [],
  brands: [
    {
      key: "agv",
      label: "AGV",
      count: 24,
      image: { url: "/media/brand-logos/agv.png", alt: "AGV", width: 120, height: 80 },
    },
    { key: "alpinestars", label: "Alpinestars", count: 18, image: null },
    { key: "external", label: "External", count: 1, image: { url: "https://example.com/logo.png" } },
  ],
  colors: [],
  finishes: [],
  genders: [],
  sizes: [],
  sizeGroups: [],
  priceRange: null,
  resultCount: 42,
  resolvedColorKeys: [],
};

const state = {
  brand: [],
  color: [],
  finish: [],
  size: [],
  gender: undefined,
  minPrice: undefined,
  maxPrice: undefined,
  inStock: false,
};

describe("CatalogSidebar brand logos", () => {
  it("renders internal logo URLs and two-letter fallback slots at the same size", () => {
    render(
      <CatalogSidebar
        facets={facets}
        current={state}
        mobileCurrent={state}
        resetHref="/sp/"
        mobileOpen={false}
        onMobileOpenChange={vi.fn()}
        onMobileChange={vi.fn()}
        onMobileApply={vi.fn()}
      />,
    );

    const slots = document.querySelectorAll('[data-brand-logo="true"]');
    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      expect(slot).toHaveClass("h-12", "w-24");
      expect(slot).not.toHaveClass("border");
      expect(slot).not.toHaveClass("border-border");
      expect(slot).not.toHaveClass("bg-muted");
    }
    expect(slots[0]?.querySelector("img")).toHaveAttribute("src", "/media/brand-logos/agv.png");
    expect(slots[0]?.querySelector("img")).toHaveClass("absolute", "inset-0", "h-full", "w-full", "object-contain");
    expect(slots[0]?.querySelector("img")).toHaveAttribute("sizes", "96px");
    expect(slots[1]).toHaveTextContent("AL");
    expect(slots[2]).toHaveTextContent("EX");
    expect(screen.getByRole("checkbox", { name: "AGV (24)" })).toBeVisible();
  });
});
