"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { iconBtn } from "@/lib/ui-classes";

export function HeaderSearchButton() {
  const t = useTranslations("Common");
  const { isPanelOpen, openPanel } = useHeaderUi();
  const open = isPanelOpen("search");

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => openPanel("search")}
      aria-label={t("search")}
      aria-expanded={open}
      className={cn(
        iconBtn,
        "bb-header-search-trigger h-full! min-h-0! w-11! px-0! hover:not-disabled:scale-100",
        open && "!text-brand-on-dark hover:!text-brand-on-dark",
      )}
    >
      <Search className="-translate-x-0.5" size={18} strokeWidth={1.75} aria-hidden />
    </Button>
  );
}
