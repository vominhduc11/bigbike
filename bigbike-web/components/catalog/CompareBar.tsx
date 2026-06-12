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
    <div className="fixed inset-x-0 z-40 border-t-2 border-brand bg-white shadow-[0_-6px_18px_rgba(0,0,0,0.12)] bottom-[calc(var(--bb-mobile-nav-height)+env(safe-area-inset-bottom))] md:bottom-0 md:pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-[var(--bb-container-xl)] items-center gap-4 px-4 py-3 pr-[84px] md:px-8">
        <div className="hidden shrink-0 flex-col justify-center sm:flex">
          <span className="font-cta text-lg font-semibold uppercase leading-none tracking-display text-foreground">
            {t("barLabel")}
          </span>
          <span className="mt-1 font-body text-xs text-muted-foreground">
            {items.length}/{max}
          </span>
        </div>

        <div className="flex flex-1 items-center gap-2.5 overflow-x-auto">
          {items.map((item) => {
            const src = resolveMediaUrl(item.imageUrl ?? undefined);
            const name = safeText(item.name, t("tableProductCol"));
            return (
              <div
                key={item.id}
                className="relative flex shrink-0 items-center gap-2.5 border border-border bg-card py-2 pl-2 pr-8"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-secondary">
                  {src && (
                    <Image
                      src={src}
                      alt={name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  )}
                </div>
                <span className="hidden max-w-[160px] truncate text-sm text-foreground md:block">
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={t("barRemoveAriaLabel", { name })}
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center text-muted-foreground transition-colors hover:text-brand pointer-coarse:after:absolute pointer-coarse:after:-inset-[10px] pointer-coarse:after:content-['']"
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
              className="flex h-[72px] shrink-0 items-center justify-center border border-dashed border-border px-4 text-xs text-muted-foreground"
            >
              <span className="hidden md:inline">{t("barAddSlot")}</span>
              <span aria-hidden="true" className="md:hidden">+</span>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={clear}
            className="whitespace-nowrap font-body text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
          >
            {t("barClearAll")}
          </button>

          <Link
            href={toComparePath()}
            aria-disabled={!canCompare}
            tabIndex={canCompare ? undefined : -1}
            className={cn(
              "inline-flex min-w-[132px] items-center justify-center whitespace-nowrap bg-brand px-5 py-3 font-cta text-base font-semibold uppercase tracking-display text-white transition-colors hover:bg-brand-hover",
              !canCompare && "pointer-events-none opacity-50",
            )}
          >
            {t("barCompare", { count: items.length })}
          </Link>
        </div>
      </div>
    </div>
  );
}
