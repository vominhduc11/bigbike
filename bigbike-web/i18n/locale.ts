/**
 * Supported storefront content languages (Đợt 2A). Vietnamese is canonical;
 * English is optional and falls back to Vietnamese field-by-field — see
 * `docs/business/BUSINESS_RULES.md` PRODUCT_RULE_001 / PRODUCT_RULE_002.
 */
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";

/**
 * Timezone canonical của storefront (Việt Nam). Phải khai báo tường minh để next-intl
 * format ngày/giờ nhất quán giữa server (render tĩnh) và client — nếu không, render tĩnh
 * sẽ ném ENVIRONMENT_FALLBACK và có nguy cơ lệch hydration.
 */
export const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
