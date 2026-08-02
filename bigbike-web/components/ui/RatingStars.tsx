import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type RatingStarsProps = {
  value: number | null | undefined;
  /** Render neutral five-outline stars when the score is unavailable. */
  empty?: boolean;
  iconClassName?: string;
  ariaLabel?: string;
  title?: string;
};

export function RatingStars({
  value,
  empty = true,
  iconClassName,
  ariaLabel,
  title,
}: RatingStarsProps) {
  const t = useTranslations("Common");
  const valid = typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 5;
  if (!valid && !empty) {
    return null;
  }
  const normalized = valid ? value : 0;
  const fallbackLabel = valid ? t("ratingStars", { rating: normalized.toFixed(1) }) : t("ratingEmptyStars");
  const label = ariaLabel ?? fallbackLabel;

  return (
    <span
      className="relative inline-flex leading-none"
      aria-label={label}
      title={title ?? label}
    >
      <span className="inline-flex" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn("h-5 w-5 shrink-0 text-muted-foreground", iconClassName)}
          />
        ))}
      </span>
      {valid ? (
        <span
          className="absolute inset-0 inline-flex overflow-hidden"
          style={{ width: `${(normalized / 5) * 100}%` }}
          aria-hidden="true"
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={cn(
                "h-5 w-5 shrink-0 fill-rating-star text-rating-star",
                iconClassName,
              )}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}
