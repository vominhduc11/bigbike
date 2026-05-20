import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveLocale } from "./locale";

/**
 * Resolves the active storefront locale per request and loads the matching
 * message catalog. Locale lives in the `NEXT_LOCALE` cookie (set by the
 * language switcher in the header); URLs stay shared across languages — slug
 * routing is the same regardless of locale per PRODUCT_RULE_003.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
