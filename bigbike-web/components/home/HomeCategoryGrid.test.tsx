import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt, fill, preload, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    void fill;
    void preload;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- test double for next/image.
      <img src={String(src)} alt={alt ?? ""} data-next-image="true" {...props} />
    );
  },
}));
vi.mock("next-intl", () => ({ useLocale: () => "vi" }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

import { HomeCategoryGrid } from "./HomeCategoryGrid";
import type { Category } from "@/lib/contracts/public";

const category = {
  id: "category-helmet",
  slug: "mu-bao-hiem",
  slugEn: "helmets",
  name: "Mũ bảo hiểm",
  image: { url: "/media/categories/helmet.png", width: 80, height: 39 },
  isVisible: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
} satisfies Category;

describe("HomeCategoryGrid image frames", () => {
  it("uses one responsive square frame independent of source dimensions", () => {
    const { container } = render(<HomeCategoryGrid initialCategories={[category]} />);

    const frame = container.querySelector("[data-home-category-grid] a > span > span");
    expect(frame).toHaveClass("relative", "mx-auto", "block", "size-16", "md:size-20", "lg:size-24");

    const image = frame?.querySelector("img");
    expect(image).toHaveClass("absolute", "inset-0", "h-full", "w-full", "object-contain");
    expect(image).toHaveAttribute("sizes", "(min-width: 1024px) 96px, (min-width: 768px) 80px, 64px");
  });
});
