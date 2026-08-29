import Link from "@/i18n/StorefrontLink";
import { getTranslations } from "next-intl/server";

import { SITE_CANVAS_CLASS } from "@/components/layout/Container";
import { LanguageSwitch } from "@/components/layout/header/LanguageSwitch";
import { MediaImage } from "@/components/ui/MediaImage";
import type { Locale } from "@/i18n/locale";
import { toHomePath } from "@/lib/utils/routes";

export async function AuthHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Cart" });

  return (
    <header data-auth-header className="w-full bg-surface-dark text-primary-foreground">
      <div
        data-auth-canvas
        className={`${SITE_CANVAS_CLASS} flex min-h-16 items-center justify-between gap-4 px-4 md:px-6`}
      >
        <Link
          href={toHomePath(locale)}
          data-auth-logo
          className="inline-flex min-h-11 min-w-11 items-center"
        >
          <MediaImage
            image={{ url: "/brand/header-mark.png", width: 120, height: 44 }}
            altFallback="BigBike"
            preload
            fetchPriority="high"
            sizes="(min-width: 640px) 120px, 96px"
            className="h-auto w-20 sm:w-30"
          />
        </Link>

        <div className="flex min-h-11 items-center gap-1 sm:gap-4">
          <Link
            href={toHomePath(locale)}
            data-auth-continue-shopping
            className="inline-flex min-h-11 items-center px-1 font-cta text-b5-label font-semibold uppercase text-primary-foreground no-underline hover:text-brand-inverse sm:px-3"
          >
            {t("continueShopping")}
          </Link>
          <LanguageSwitch variant="auth" />
        </div>
      </div>
    </header>
  );
}
