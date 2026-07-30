import { describe, expect, it } from "vitest";

import type { HomeSlider } from "@/lib/contracts/public";
import { toHeroSlide } from "./heroSliderModel";

function slider(overrides: Partial<HomeSlider> = {}): HomeSlider {
  return {
    id: "slider-home",
    desktopImage: {
      url: "/media/sliders/desktop.jpg",
      alt: "Ảnh desktop",
    },
    externalLink: "/sp/",
    ...overrides,
  };
}

describe("toHeroSlide", () => {
  it("maps the optional mobile image through the same media URL normalization", () => {
    expect(toHeroSlide(slider({
      mobileImage: {
        url: " /media/sliders/mobile.jpg ",
        alt: "Ảnh mobile",
      },
    }))).toEqual(expect.objectContaining({
      desktopSrc: "/media/sliders/desktop.jpg",
      mobileSrc: "/media/sliders/mobile.jpg",
    }));
  });

  it("keeps the desktop image and returns a null mobile source when mobile is missing", () => {
    expect(toHeroSlide(slider({ mobileImage: null }))).toEqual(expect.objectContaining({
      desktopSrc: "/media/sliders/desktop.jpg",
      mobileSrc: null,
    }));
  });

  it("rejects a slider without a desktop image even when a mobile image exists", () => {
    expect(toHeroSlide(slider({
      desktopImage: null,
      mobileImage: { url: "/media/sliders/mobile-only.jpg" },
    }))).toBeNull();
  });
});
