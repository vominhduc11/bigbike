"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCompare } from "@/lib/compare-context";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toComparePath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";

/**
 * Persistent bottom bar listing the products queued for comparison. Renders
 * nothing while the list is empty. Right padding clears the floating chat
 * button so the action buttons stay tappable.
 */
export function CompareBar() {
  const t = useTranslations("Compare");
  const { items, remove, clear, max } = useCompare();

  if (items.length === 0) return null;

  const emptySlots = Math.max(0, max - items.length);
  const canCompare = items.length >= 2;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white shadow-[0_-4px_14px_rgba(0,0,0,0.1)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5 pr-[84px]">
        <span className="hidden shrink-0 font-heading text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:block">
          {t("barLabel")}
        </span>

        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {items.map((item) => {
            const src = resolveMediaUrl(item.imageUrl ?? undefined);
            const name = safeText(item.name, t("tableProductCol"));
            return (
              <div
                key={item.id}
                className="relative flex shrink-0 items-center gap-2 border border-border bg-card py-1.5 pl-1.5 pr-7"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden bg-secondary">
                  {src && (
                    <Image
                      src={src}
                      alt={name}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  )}
                </div>
                <span className="hidden max-w-[140px] truncate text-sm text-foreground md:block">
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={t("barRemoveAriaLabel", { name })}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center text-muted-foreground transition-colors hover:text-brand"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
          {Array.from({ length: emptySlots }, (_, i) => (
            <div
              key={`empty-${i}`}
              className="flex h-[52px] shrink-0 items-center justify-center border border-dashed border-border px-3 text-xs text-muted-foreground"
            >
              <span className="hidden md:inline">{t("barAddSlot")}</span>
              <span aria-hidden="true" className="md:hidden">+</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={clear}
          className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-brand"
        >
          {t("barClearAll")}
        </button>

        <Link
          href={toComparePath()}
          aria-disabled={!canCompare}
          tabIndex={canCompare ? undefined : -1}
          className={cn(
            "shrink-0 whitespace-nowrap bg-brand px-4 py-2.5 font-heading text-sm font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:bg-brand-hover",
            !canCompare && "pointer-events-none opacity-50",
          )}
        >
          {t("barCompare", { count: items.length })}
        </Link>
      </div>
    </div>
  );
}
