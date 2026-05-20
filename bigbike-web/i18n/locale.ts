/**
 * Supported storefront content languages (Đợt 2A). Vietnamese is canonical;
 * English is optional and falls back to Vietnamese field-by-field — see
 * `docs/business/BUSINESS_RULES.md` PRODUCT_RULE_001 / PRODUCT_RULE_002.
 */
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";

/** Name of the cookie that holds the visitor's locale preference. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
