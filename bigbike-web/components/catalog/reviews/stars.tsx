"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      className={cn("h-4 w-4", className)}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export function StarRow({ rating, iconClassName }: { rating: number; iconClassName?: string }) {
  const t = useTranslations("Product.reviews");
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={t("starsCount", { count: rating.toFixed(1) })}
    >
      {Array.from({ length: 5 }, (_, i) => {
        // Tô theo tỷ lệ liên tục như RatingStars (REVIEW_RULE_002): 4.5 → nửa
        // sao thứ 5, không Math.round thành 5 sao đầy. Sao lẻ = overlay sao đầy
        // cắt theo % width trên nền sao rỗng.
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} className="relative inline-flex">
            <StarIcon
              filled={fill >= 1}
              className={cn(iconClassName, fill >= 1 ? "text-brand" : "text-[var(--bb-text-secondary)]")}
            />
            {fill > 0 && fill < 1 && (
              <span
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <StarIcon filled className={cn(iconClassName, "text-brand")} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const t = useTranslations("Product.reviews");
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label={t("formStars")}
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const active = display >= star;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={t("starsCount", { count: star })}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHover(star)}
              className={cn(
                "p-0.5 cursor-pointer transition-colors duration-[var(--bb-duration-fast)] outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
                active ? "text-brand" : "text-[var(--bb-text-secondary)]",
              )}
            >
              <StarIcon filled={active} className="h-8 w-8" />
            </button>
          );
        })}
      </div>
      {display > 0 && (
        <span className="font-body text-a4-content font-semibold text-[var(--bb-text-primary)]">
          {display}/5
        </span>
      )}
    </div>
  );
}
