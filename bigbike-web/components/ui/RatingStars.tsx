import { Star } from "lucide-react";

type RatingStarsProps = {
  value: number;
};

export function RatingStars({ value }: RatingStarsProps) {
  const normalized = Number.isFinite(value)
    ? Math.min(5, Math.max(0, value))
    : 4.5;

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
