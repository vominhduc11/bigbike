"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { CATALOG_FILTER_OPEN_EVENT } from "@/components/catalog/catalog-events";
import { Button } from "@/components/ui/button";

export function MobileFilterTrigger() {
  const t = useTranslations("Catalog");
  return (
    <Button
      type="button"
      variant="outline"
      className="order-1 h-[52px] w-full justify-between rounded-none border-border px-5 font-cta text-caption font-semibold uppercase md:hidden"
      onClick={() => window.dispatchEvent(new CustomEvent(CATALOG_FILTER_OPEN_EVENT))}
    >
      {t("filterMobileHeading")}
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
    </Button>
  );
}
