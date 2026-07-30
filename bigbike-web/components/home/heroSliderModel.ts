import type { HeroSlide } from "@/components/home/HeroSlider";
import type { HomeSlider } from "@/lib/contracts/public";
import {
  resolveMediaUrl,
  toLegacyWpMediaUrl,
  toSafePublicHref,
} from "@/lib/utils/format";

export function toHeroSlide(slider: HomeSlider): HeroSlide | null {
  const desktopSrc = toLegacyWpMediaUrl(resolveMediaUrl(slider.desktopImage?.url?.trim()));
  if (!desktopSrc) return null;

  const mobileSrc = toLegacyWpMediaUrl(resolveMediaUrl(slider.mobileImage?.url?.trim()));
  const productName = slider.productName?.trim() ?? "";
  const categoryName = slider.categoryName?.trim() ?? "";

  return {
    id: slider.id,
    desktopSrc,
    mobileSrc,
    alt: productName || categoryName || "BigBike",
    href: toSafePublicHref(slider.productLink, "") || null,
    productName,
    categoryName,
    productCode: slider.sku?.trim() || "BIGBIKE",
  };
}
