import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
import { HeroSlider, type HeroSlide } from "./HeroSlider";

// Assert the href passed to Next Link; Vitest does not load Next's trailingSlash build setting.
vi.mock("@/i18n/StorefrontLink", () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));

vi.mock("swiper/react", () => ({
  Swiper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SwiperSlide: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("swiper/modules", () => ({ Autoplay: {} }));

const slide: HeroSlide = {
  id: "E2E_HERO_I18N",
  desktopSrc: "/media/e2e/banner.webp",
  mobileSrc: null,
  alt: "E2E Helmet",
  href: "/product/e2e-helmet/?variant=e2e#details",
  productName: "E2E Helmet",
  categoryName: "",
  productCode: "E2E_HELMET",
};

describe.each(["vi", "en"] as const)("HeroSlider links in %s", (locale) => {
  it.each(["/product/e2e-helmet/?variant=e2e#details", "/sp/e2e-helmet.html", null])(
    "localizes %s without changing image metadata",
    (href) => {
      render(
        <NextIntlClientProvider
          locale={locale}
          messages={locale === "en" ? en : viMessages}
          timeZone="Asia/Ho_Chi_Minh"
        >
          <HeroSlider slides={[{ ...slide, href }]} />
        </NextIntlClientProvider>,
      );
      const expected =
        href === null
          ? locale === "en"
            ? "/en/products/"
            : "/sp/"
          : `${locale === "en" ? "/en" : ""}${href.includes(".html") ? `${href}/` : href}`;
      expect(screen.getByRole("link", { name: "E2E Helmet - E2E_HELMET" })).toHaveAttribute(
        "href",
        expected,
      );
      expect(screen.getByAltText("E2E Helmet")).toHaveAttribute("src", slide.desktopSrc);
    },
  );
});
