"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { iconBtn } from "@/lib/ui-classes";

export function HeaderSearchButton() {
  const t = useTranslations("Common");
  const { openPanel } = useHeaderUi();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => openPanel("search")}
      aria-label={t("search")}
      className={cn(iconBtn, "bb-header-search-trigger h-20! min-h-20! px-5! hover:not-disabled:scale-100")}
    >
      <Search className="-translate-x-0.5" size={18} strokeWidth={1.75} aria-hidden />
    </Button>
  );
}
