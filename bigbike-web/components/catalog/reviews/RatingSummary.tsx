"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { StarIcon, StarRow } from "./stars";

export function RatingSummary({
  avg,
  total,
  breakdown,
  activeStar,
  onSelectStar,
}: {
  avg: number;
  total: number;
  breakdown: Record<string, number>;
  activeStar: number | null;
  onSelectStar: (star: number) => void;
}) {
  const t = useTranslations("Product.reviews");
  return (
    <div className="flex flex-col gap-6 border border-border p-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex shrink-0 flex-col items-center justify-center gap-2 max-sm:border-b max-sm:border-border max-sm:pb-6 sm:w-[160px] sm:border-r sm:border-border">
        <div className="flex items-baseline gap-1">
          <span className="font-cta text-a1-title font-semibold leading-none text-[var(--bb-text-primary)]">
            {avg.toFixed(1)}
          </span>
          <span className="text-a5-meta text-muted-foreground">/5</span>
        </div>
        <StarRow rating={avg} iconClassName="h-5 w-5" />
        <span className="text-a5-meta text-muted-foreground">{t("ratingCount", { count: total })}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-1.5" role="group" aria-label={t("filterByStarHint")}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = breakdown?.[String(star)] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isActive = activeStar === star;
          const disabled = count === 0;
          return (
            <button
              key={star}
              type="button"
              aria-pressed={isActive}
              disabled={disabled}
              onClick={() => onSelectStar(star)}
              title={t("starsCount", { count: star })}
              className={cn(
                "flex items-center gap-3 px-2 py-1 -mx-2 text-left transition-colors duration-[var(--bb-duration-fast)] outline-none",
                "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
                disabled ? "cursor-default opacity-60" : "cursor-pointer hover:bg-muted",
                isActive && "bg-muted",
              )}
            >
              <span className="flex w-9 shrink-0 items-center gap-1 text-a5-meta text-[var(--bb-text-secondary)]">
                {star}
                <StarIcon filled className="h-3.5 w-3.5 text-brand" />
              </span>
              <span className="h-2 flex-1 overflow-hidden bg-background">
                <span className="block h-full bg-brand" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-7 shrink-0 text-right text-a5-meta text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
