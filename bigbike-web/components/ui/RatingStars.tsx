import { Star } from "lucide-react";

type RatingStarsProps = {
  value: number | null | undefined;
};

export function RatingStars({ value }: RatingStarsProps) {
  // REVIEW_RULE_003: không có giá trị hợp lệ (> 0) thì ẨN hoàn toàn — tuyệt đối
  // không vẽ sao mặc định (4.5 cũ) khi thiếu dữ liệu / 0 review.
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const normalized = Math.min(5, value);

  return (
    <span
      className="relative inline-flex leading-none"
      aria-label={`${normalized.toFixed(1)} sao`}
      title={`${normalized.toFixed(1)} sao`}
    >
      <span className="inline-flex" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className="h-[1em] w-[1em] shrink-0 text-muted-foreground" />
        ))}
      </span>
      <span
        className="absolute inset-0 overflow-hidden inline-flex"
        style={{ width: `${(normalized / 5) * 100}%` }}
        aria-hidden="true"
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className="h-[1em] w-[1em] shrink-0 fill-rating-star text-rating-star" />
        ))}
      </span>
    </span>
  );
}
