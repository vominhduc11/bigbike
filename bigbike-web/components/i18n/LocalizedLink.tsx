"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useSyncExternalStore, type ComponentProps } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import {
  toArticlePath,
  toBrandPath,
  toCategoryPath,
  toProductPath,
} from "@/lib/utils/routes";

/**
 * Navigation link that points to the language-appropriate URL slug while the
 * visitor is browsing in English (PRODUCT/CATEGORY/ARTICLE_RULE_003).
 * Brand links deliberately keep the shared brand slug in every locale
 * (BRAND_RULE_003).
 *
 * Why a wrapper: the server ALWAYS renders the canonical `vi` locale (so ISR
 * caches a single HTML — `i18n/request.ts` deliberately ignores the cookie), so
 * every `href` in server HTML is a vi slug. Flipping to the English slug must
 * happen ON THE CLIENT after hydration. The `hydrated` flag (server snapshot
 * `false`, client snapshot `true`) guarantees the first client render matches the
 * server (vi); only after hydration does it swap to the English slug — avoiding a
 * hydration mismatch.
 *
 * Pure client UX improvement: canonical stays vi and hreflang is already emitted
 * by `buildPublicMetadata`, so no SEO/server change is needed.
 *
 * `enSlug` null/undefined → always falls back to the vi slug.
 */

type LinkProps = Omit<ComponentProps<typeof Link>, "href">;

const PATH_FOR_KIND = {
  category: toCategoryPath,
  product: toProductPath,
  brand: toBrandPath,
  article: toArticlePath,
} as const;

export type LocalizedLinkKind = keyof typeof PATH_FOR_KIND;

const noopSubscribe = () => () => {};

/** False on the server + first client render, true once hydrated (no setState-in-effect). */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function LocalizedLink({
  kind,
  viSlug,
  enSlug,
  ...rest
}: LinkProps & {
  kind: LocalizedLinkKind;
  viSlug: string;
  enSlug?: string | null;
}) {
  const locale = useLocale();
  const hydrated = useHydrated();

  const useEn = hydrated && locale !== DEFAULT_LOCALE;
  let href = "/";
  if (kind === "category") {
    href = toCategoryPath(useEn ? (enSlug || viSlug) : viSlug, locale as Locale, !!(useEn && enSlug));
  } else if (kind === "article") {
    href = toArticlePath(useEn ? (enSlug || viSlug) : viSlug, locale as Locale, !!(useEn && enSlug));
  } else if (kind === "brand") {
    href = toBrandPath(viSlug);
  } else {
    href = PATH_FOR_KIND[kind](useEn ? (enSlug || viSlug) : viSlug);
  }

  return <Link href={href} {...rest} />;
}
