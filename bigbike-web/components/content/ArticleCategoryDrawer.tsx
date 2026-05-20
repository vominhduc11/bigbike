"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ContentCategoryWithCount } from "@/lib/contracts/public";
import { buildQueryString } from "@/lib/utils/query";
import { toArticleListPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";

type ArticleCategoryDrawerProps = {
  categories: ContentCategoryWithCount[];
  currentCategory?: string;
};

export function ArticleCategoryDrawer({
  categories,
  currentCategory,
}: ArticleCategoryDrawerProps) {
  const t = useTranslations("Blog");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | undefined>(currentCategory);

  function handleOpenChange(next: boolean) {
    if (next) setSelected(currentCategory);
    setOpen(next);
  }

  function handleApply() {
    const href = `${toArticleListPath()}${buildQueryString({ category: selected })}`;
    setOpen(false);
    router.push(href);
  }

  function handleReset() {
    setSelected(undefined);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between border border-border bg-card px-4 py-3 text-left font-display text-sm font-semibold uppercase tracking-[0.04em] text-foreground transition-colors hover:border-brand"
          aria-label={t("categoryDrawerOpenAriaLabel")}
        >
          <span className="flex items-center gap-1.5">
            <span className="text-brand" aria-hidden="true">*</span>
            {t("categoryDrawerTitle")}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-[88%] max-w-[400px] flex-col p-0">
        <div className="border-b border-border px-5 py-4">
          <SheetTitle className="font-display text-lg font-semibold uppercase tracking-[0.04em] text-foreground">
            {t("categoryDrawerTitle")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("categoryDrawerDesc")}
          </SheetDescription>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h3 className="m-0 mb-4 font-display text-base font-semibold uppercase tracking-[0.02em] text-foreground">
            {t("categoryDrawerCategoriesHeading")}
          </h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {categories.map((cat) => {
              const isActive = selected === cat.slug;
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(isActive ? undefined : cat.slug)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-b border-border py-3 text-left font-body text-sm transition-colors",
                      isActive
                        ? "font-semibold text-brand"
                        : "text-foreground hover:text-brand",
                    )}
                  >
                    {isActive && (
                      <span className="h-1.5 w-1.5 shrink-0 rotate-45 bg-brand" aria-hidden="true" />
                    )}
                    <span className="flex-1">{cat.name}</span>
                    <span
                      className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center"
                      aria-hidden="true"
                    >
                      <span className="absolute inset-1 rotate-45 bg-foreground" />
                      <span className="relative text-xs font-semibold tabular-nums text-white">
                        {cat.articleCount}
                      </span>
                    </span>
                    <span className="sr-only">{t("categoryArticleCount", { count: cat.articleCount })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex border-t border-border">
          <Button type="button" variant="primary" onClick={handleApply} className="flex-1 rounded-none">
            {t("categoryDrawerApply")}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="dark" onClick={handleReset} className="flex-1 rounded-none">
            {t("categoryDrawerReset")}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
