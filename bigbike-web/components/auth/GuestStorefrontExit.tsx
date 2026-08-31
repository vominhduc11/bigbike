"use client";

import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/locale";
import { getGuestStorefrontHref } from "@/lib/utils/routes";

/** A safe, always-visible way for an unauthenticated visitor to resume browsing. */
export function GuestStorefrontExit({ returnTo }: { returnTo?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("Auth.guest");

  return (
    <div
      data-auth-guest-exit
      className="mt-3 border-t border-border pt-3 text-center md:mt-5 md:pt-5 lg:mt-2 lg:pt-2"
    >
      <Link
        href={getGuestStorefrontHref(returnTo, locale)}
        className="inline-flex min-h-11 items-center justify-center text-a5-meta font-semibold text-blue underline hover:no-underline"
      >
        {t("action")}
      </Link>
    </div>
  );
}
