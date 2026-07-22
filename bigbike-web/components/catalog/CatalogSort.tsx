"use client";

import { Suspense, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { isCatalogOrderbyValue, productSortToOrderby } from "@/lib/utils/catalog-sort";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "menu_order", labelKey: "default" },
  { value: "popularity", labelKey: "popularity" },
  { value: "date", labelKey: "date" },
  { value: "price", labelKey: "priceAsc" },
  { value: "price-desc", labelKey: "priceDesc" },
] as const;

type CatalogSortSelectProps = {
  selectedValue: string;
  sortLabel: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

function CatalogSortSelect({
  selectedValue,
  sortLabel,
  disabled = false,
  onValueChange,
}: CatalogSortSelectProps) {
  const t = useTranslations("Catalog");
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = SORT_OPTIONS.findIndex((option) => option.value === selectedValue);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedOption = SORT_OPTIONS[activeIndex] ?? SORT_OPTIONS[0];
  const interactive = Boolean(onValueChange) && !disabled;
  const menuOpen = open && interactive;

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  function focusOption(index: number) {
    optionRefs.current[index]?.focus();
  }

  function openMenu(focusIndex = activeIndex) {
    if (!interactive) return;
    setOpen(true);
    requestAnimationFrame(() => focusOption(focusIndex));
  }

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectValue(value: string) {
    setOpen(false);
    triggerRef.current?.focus();
    if (value !== selectedValue) onValueChange?.(value);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!interactive) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(SORT_OPTIONS.length - 1);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? SORT_OPTIONS.length - 1
            : event.key === "ArrowDown"
              ? (index + 1) % SORT_OPTIONS.length
              : (index - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length;
      focusOption(nextIndex);
    }
  }

  return (
    <div ref={rootRef} className="relative w-full md:w-auto">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="lg"
        aria-label={sortLabel}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? listboxId : undefined}
        disabled={!interactive}
        onClick={() => (menuOpen ? setOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        className="h-13! w-full justify-between rounded-none border border-border bg-white px-5 py-0 text-left font-cta text-b4-action font-semibold uppercase text-foreground hover:bg-white hover:not-disabled:scale-100 focus-visible:border-ring focus-visible:shadow-[var(--bb-focus-ring)] md:min-w-50"
      >
        <span className="line-clamp-1">{t(`sort.${selectedOption.labelKey}`)}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform duration-[var(--bb-duration-fast)]", menuOpen && "rotate-180")}
          aria-hidden
        />
      </Button>
      {menuOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={sortLabel}
          className="absolute right-0 top-full z-[var(--bb-z-dropdown)] mt-1 max-h-96 w-72 max-w-[calc(100vw-var(--bb-space-8))] min-w-full overflow-auto border border-border bg-popover p-1 text-popover-foreground shadow-[var(--bb-shadow-dropdown)]"
        >
          {SORT_OPTIONS.map(({ value, labelKey }, index) => {
            const selected = value === selectedValue;
            const optionLabel = t(`sort.${labelKey}`);
            return (
              <Button
                key={value}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                variant="ghost"
                size="sm"
                role="option"
                aria-label={optionLabel}
                aria-selected={selected}
                onClick={() => selectValue(value)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={cn(
                  "relative min-h-10 w-full justify-start rounded-none px-8 py-2 text-left font-body text-a5-meta font-normal normal-case text-foreground hover:bg-accent hover:not-disabled:scale-100 focus-visible:bg-accent focus-visible:outline-none",
                  selected && "font-semibold",
                )}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {selected ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
                </span>
                {optionLabel}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CatalogSortStatic({ current }: { current: string }) {
  const t = useTranslations("Catalog");
  const selectedValue = isCatalogOrderbyValue(current) ? current : productSortToOrderby(current);
  return (
    <CatalogSortSelect
      selectedValue={selectedValue}
      sortLabel={t("sortLabel")}
      disabled
    />
  );
}

function CatalogSortInner({ current }: { current: string }) {
  const t = useTranslations("Catalog");
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedValue = isCatalogOrderbyValue(current) ? current : productSortToOrderby(current);

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "menu_order") params.delete("orderby");
    else params.set("orderby", value);
    params.delete("sort");
    params.delete("page");
    params.delete("paged");
    const next = params.toString();
    router.push(next ? `${window.location.pathname}?${next}` : window.location.pathname);
  }

  return (
    <CatalogSortSelect
      selectedValue={selectedValue}
      sortLabel={t("sortLabel")}
      onValueChange={handleChange}
    />
  );
}

export function CatalogSort({ current }: { current: string }) {
  return (
    <Suspense fallback={<CatalogSortStatic current={current} />}>
      <CatalogSortInner current={current} />
    </Suspense>
  );
}
