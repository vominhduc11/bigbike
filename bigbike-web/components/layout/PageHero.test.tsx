import { render, screen } from "@testing-library/react";
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
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

import { PageHero } from "./PageHero";

describe("PageHero illustration frame", () => {
  it("reserves the fixed desktop frame even without image metadata", () => {
    render(
      <PageHero
        title="Thương hiệu"
        breadcrumb={[{ label: "Thương hiệu" }]}
        illustrationUrl="/brand/page-title-illustration.png"
      />,
    );

    const frame = document.querySelector("[data-page-hero-illustration]");
    expect(frame).toHaveClass("relative", "h-100", "w-full");
    expect(frame?.parentElement).toHaveClass("absolute", "max-w-[451px]");

    const image = screen.getByRole("img", { name: "Thương hiệu" });
    expect(image).toHaveClass("absolute", "inset-0", "h-full", "w-full", "object-contain");
    expect(image).toHaveAttribute(
      "sizes",
      "(min-width: 950px) 451px, (min-width: 768px) calc((100vw - 48px) / 2), 0px",
    );
  });
});
