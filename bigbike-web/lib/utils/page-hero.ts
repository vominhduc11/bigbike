import type { PublicSiteSetting } from "@/lib/contracts/public";

export type HeroSettingPrefix = "hero_products" | "hero_brands" | "hero_news";

type HeroPropsFromSettings = {
  imageUrl: string | null;
  mobileImageUrl: string | null;
  imageAlt: string | null;
  title: string | null;
};

function findValue(settings: PublicSiteSetting[], key: string): string | null {
  const value = settings.find((s) => s.settingKey === key)?.settingValue?.trim();
  return value ? value : null;
}

export function readHeroSettings(
  settings: PublicSiteSetting[],
  prefix: HeroSettingPrefix,
): HeroPropsFromSettings {
  return {
    imageUrl: findValue(settings, `${prefix}_image_url`),
    mobileImageUrl: findValue(settings, `${prefix}_mobile_image_url`),
    imageAlt: findValue(settings, `${prefix}_image_alt`),
    title: findValue(settings, `${prefix}_title`),
  };
}

export type DefaultHeroAssets = {
  defaultBgUrl: string | null;
  defaultIllustrationUrl: string | null;
};

export function readDefaultHeroAssets(settings: PublicSiteSetting[]): DefaultHeroAssets {
  return {
    defaultBgUrl: findValue(settings, "hero_default_bg_url"),
    defaultIllustrationUrl: findValue(settings, "hero_default_illustration_url"),
  };
}
