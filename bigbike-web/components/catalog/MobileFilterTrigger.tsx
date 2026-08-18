"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { CATALOG_FILTER_OPEN_EVENT } from "@/components/catalog/catalog-events";
import { Button } from "@/components/ui/button";

export function MobileFilterTrigger({ activeCount = 0 }: { activeCount?: number }) {
  const t = useTranslations("Catalog");
  return (
    <Button
      data-mobile-filter-trigger
      type="button"
      variant="outline"
      className="order-1 h-13 w-full justify-between rounded-none border-border px-5 font-cta text-b4-action font-semibold uppercase md:hidden"
      onClick={() => window.dispatchEvent(new CustomEvent(CATALOG_FILTER_OPEN_EVENT))}
    >
      <span className="flex items-center gap-2">
        {t("filterMobileHeading")}
        {activeCount > 0 ? (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1 text-b5-label text-primary-foreground" aria-label={t("activeFilterCount", { count: activeCount })}>
            {activeCount}
          </span>
        ) : null}
      </span>
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
    </Button>
  );
}
