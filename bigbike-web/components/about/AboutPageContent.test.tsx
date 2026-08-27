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
vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

import { AboutPageContent } from "./AboutPageContent";

describe("AboutPageContent brand frames", () => {
  it("keeps every about-page brand logo in a centered 128px frame", () => {
    const { container } = render(
      <AboutPageContent
        brands={[{ id: "agv", name: "AGV", slug: "agv", logo: { url: "/media/brands/agv.png", width: 128, height: 55 } }]}
        contact={{ address: "Địa chỉ cửa hàng", hotline: "0900000000", hotline2: "", facebookUrl: "https://facebook.com/bigbike" }}
      />,
    );

    const frame = container.querySelector("[data-about-brand-grid] > a > span");
    expect(frame).toHaveClass("relative", "size-32");
    expect(frame?.querySelector("img")).toHaveClass("absolute", "inset-0", "h-full", "w-full", "object-contain");
    expect(frame?.querySelector("img")).toHaveAttribute("sizes", "128px");
  });
});
