"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Shares a detail page's vi + en URL slugs with the header `LanguageSwitcher`
 * so switching language NAVIGATES to the language-appropriate URL
 * (PRODUCT/CATEGORY/BRAND_RULE_003).
 *
 * The switcher lives in the header (rendered by `app/layout.tsx`), which is a
 * SIBLING of the page — React context only flows down, so the provider is mounted
 * in the layout (above both header and page) and the detail page publishes its
 * slugs upward via {@link AltSlugRegistrar}. Pages without a registrar leave the
 * value null and the switcher keeps its in-place cookie swap (home, listings).
 *
 * Server still renders the canonical `vi` page (ISR intact — see
 * `docs/engineering/ARCHITECTURE.md` §i18n). `enSlug` null → switching to EN stays
 * on the vi URL; the page still localizes its CONTENT via `LocalizedContentProvider`.
 */

export type AltSlugKind = "category" | "product" | "brand";

type AltSlug = { kind: AltSlugKind; viSlug: string; enSlug: string | null };

type AltSlugContextValue = { value: AltSlug | null; setValue: (next: AltSlug | null) => void };

const AltSlugContext = createContext<AltSlugContextValue>({ value: null, setValue: () => {} });

export function AltSlugProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<AltSlug | null>(null);
  return <AltSlugContext.Provider value={{ value, setValue }}>{children}</AltSlugContext.Provider>;
}

/** The current detail page's alt-slug info, or null on pages without a registrar. */
export function useAltSlug(): AltSlug | null {
  return useContext(AltSlugContext).value;
}

/**
 * Rendered by a detail page (server component) to publish its slugs to the header
 * switcher. Clears on unmount so navigating to a non-detail page drops the value.
 */
export function AltSlugRegistrar({
  kind,
  viSlug,
  enSlug,
}: {
  kind: AltSlugKind;
  viSlug: string;
  enSlug: string | null;
}) {
  const { setValue } = useContext(AltSlugContext);
  useEffect(() => {
    setValue({ kind, viSlug, enSlug });
    return () => setValue(null);
  }, [kind, viSlug, enSlug, setValue]);
  return null;
}
