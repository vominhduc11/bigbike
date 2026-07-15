import type { PublicSiteSetting } from "@/lib/contracts/public";

 type HeroSettingPrefix = "hero_products" | "hero_brands" | "hero_news";

type HeroPropsFromSettings = {
  imageUrl: string | null;
  illustrationUrl: string | null;
  imageAlt: string | null;
  title: string | null;
};

function findValue(settings: PublicSiteSetting[], key: string): string | null {
  const value = Array.isArray(settings)
    ? settings.find((s) => s.settingKey === key)?.settingValue?.trim()
    : "";
  return value ? value : null;
}

export function readHeroSettings(
  settings: PublicSiteSetting[],
  prefix: HeroSettingPrefix,
): HeroPropsFromSettings {
  return {
    imageUrl: findValue(settings, `${prefix}_image_url`),
    illustrationUrl: findValue(settings, `${prefix}_illustration_url`),
    imageAlt: findValue(settings, `${prefix}_image_alt`),
    title: findValue(settings, `${prefix}_title`),
  };
}

 type DefaultHeroAssets = {
  defaultBgUrl: string | null;
  defaultIllustrationUrl: string | null;
};

export function readDefaultHeroAssets(settings: PublicSiteSetting[]): DefaultHeroAssets {
  return {
    defaultBgUrl: findValue(settings, "hero_default_bg_url"),
    defaultIllustrationUrl: findValue(settings, "hero_default_illustration_url"),
  };
}
