type RatingStarsProps = {
  value: number;
};

export function RatingStars({ value }: RatingStarsProps) {
  const normalized = Number.isFinite(value)
    ? Math.min(5, Math.max(0, value))
    : 4.5;

  return (
    <span
      className="bb-rating-stars"
      aria-label={`${normalized.toFixed(1)} sao`}
      title={`${normalized.toFixed(1)} sao`}
    >
      <span className="bb-rating-stars-empty" aria-hidden="true">
        ☆☆☆☆☆
      </span>
      <span
        className="bb-rating-stars-fill"
        style={{ width: `${(normalized / 5) * 100}%` }}
        aria-hidden="true"
      >
        ★★★★★
      </span>
    </span>
  );
}
