import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const locale = vi.hoisted(() => ({ current: "vi" }));

vi.mock("next-intl", () => ({
  useLocale: () => locale.current,
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("swiper/modules", () => ({ Autoplay: {} }));
vi.mock("swiper/react", () => ({
  Swiper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SwiperSlide: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { BrandCarousel } from "./BrandCarousel";
import type { Brand } from "@/lib/contracts/public";

function brand(): Brand {
  return {
    id: "brand-agv",
    slug: "agv",
    name: "AGV",
    logo: { url: "/media/brands/agv.png" },
    isVisible: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as Brand;
}

describe("BrandCarousel brand links", () => {
  it("links to the trailing-slash brand URL so the click does not cost a 308 hop", () => {
    locale.current = "vi";
    render(<BrandCarousel brands={[brand()]} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/brands/agv/");
  });

  it("keeps English visitors on the English brand page", () => {
    locale.current = "en";
    render(<BrandCarousel brands={[brand()]} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/en/brands/agv/");
  });

  it("keeps every logo inside the same centered square frame", () => {
    locale.current = "vi";
    render(<BrandCarousel brands={[brand()]} />);

    const frame = document.querySelector('[data-brand-logo="true"]');
    expect(frame).toHaveClass("size-22", "aspect-square");
    expect(frame?.querySelector("img")).toHaveClass("object-contain");
    expect(frame?.querySelector("img")).toHaveAttribute("sizes", "88px");
  });

  it("shows initials instead of the shop logo when a brand has no logo", () => {
    render(
      <BrandCarousel
        brands={[
          { ...brand(), id: "brand-dainese", slug: "dainese", name: "DAINESE", logo: undefined },
        ]}
      />,
    );

    expect(screen.getByText("DA")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByLabelText("DAINESE")).toHaveClass("aspect-square");
  });
});
