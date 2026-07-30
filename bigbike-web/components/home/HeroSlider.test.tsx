import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));
vi.mock("swiper/modules", () => ({ Autoplay: {} }));
vi.mock("swiper/react", () => ({
  Swiper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SwiperSlide: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { HeroSlider, type HeroSlide } from "./HeroSlider";

function slide(overrides: Partial<HeroSlide> = {}): HeroSlide {
  return {
    id: "slider-home",
    desktopSrc: "/media/sliders/desktop.jpg",
    mobileSrc: null,
    alt: "Banner trang chủ",
    href: "/sp/",
    productName: "",
    categoryName: "",
    productCode: "BIGBIKE",
    ...overrides,
  };
}

describe("HeroSlider responsive image", () => {
  it("renders a mobile source below 768px while keeping desktop as the img fallback", () => {
    const { container } = render(
      <HeroSlider slides={[slide({ mobileSrc: "/media/sliders/mobile.jpg" })]} />,
    );

    const source = container.querySelector('source[media="(max-width: 767px)"]');
    expect(source).toHaveAttribute("srcset", "/media/sliders/mobile.jpg");
    expect(screen.getByRole("img", { name: "Banner trang chủ" }))
      .toHaveAttribute("src", "/media/sliders/desktop.jpg");
  });

  it("renders only the desktop img when the optional mobile image is absent", () => {
    const { container } = render(<HeroSlider slides={[slide()]} />);

    expect(container.querySelector("source")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Banner trang chủ" }))
      .toHaveAttribute("src", "/media/sliders/desktop.jpg");
  });
});
