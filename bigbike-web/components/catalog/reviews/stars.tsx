"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

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
      <path d={STAR_PATH} />
    </svg>
  );
}

// Sao tô một phần (0 < fill < 1, REVIEW_RULE_002 — không Math.round thành sao
// đầy) dùng linearGradient tô màu NGAY TRONG path ngôi sao, không cắt hình chữ
// nhật đè lên trên. Path 5 cánh có góc lõm nên clip theo width% từng làm vỡ nét/
// méo hình ở cạnh cắt; gradient giữ nguyên toàn bộ hình sao, chỉ chuyển màu.
export function PartialStarIcon({ fill, className, gradientId }: { fill: number; className?: string; gradientId: string }) {
  const pct = Math.round(fill * 100);
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("h-4 w-4 text-brand", className)}>
      <defs>
        <linearGradient id={gradientId}>
          <stop offset={`${pct}%`} stopColor="currentColor" />
          <stop offset={`${pct}%`} stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={STAR_PATH} fill={`url(#${gradientId})`} stroke={`url(#${gradientId})`} strokeWidth="1.8" />
    </svg>
  );
}

// REVIEW_RULE_008: khách chọn được nửa sao — bấm/chạm nửa trái của sao thứ N
// chọn (N - 0.5), nửa phải chọn N nguyên.
function starValueFromPointer(e: { currentTarget: HTMLElement; clientX: number }, star: number): number {
  const rect = e.currentTarget.getBoundingClientRect();
  const isLeftHalf = e.clientX - rect.left < rect.width / 2;
  return isLeftHalf ? star - 0.5 : star;
}

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const t = useTranslations("Product.reviews");
  const uid = useId();
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
          const fill = Math.max(0, Math.min(1, display - (star - 1)));
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={t("starsCount", { count: star })}
              onClick={(e) => onChange(starValueFromPointer(e, star))}
              onMouseMove={(e) => setHover(starValueFromPointer(e, star))}
              className="relative cursor-pointer p-0.5 outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              <StarIcon filled={false} className="h-8 w-8 text-[var(--bb-text-secondary)]" />
              {fill > 0 && (
                <span className="pointer-events-none absolute inset-0.5">
                  {fill >= 1 ? (
                    <StarIcon filled className="h-8 w-8 text-brand" />
                  ) : (
                    <PartialStarIcon fill={fill} className="h-8 w-8" gradientId={`${uid}-input-star-${star}`} />
                  )}
                </span>
              )}
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
