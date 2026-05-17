type RatingStarsProps = {
  value: number;
};

export function RatingStars({ value }: RatingStarsProps) {
  const normalized = Number.isFinite(value)
    ? Math.min(5, Math.max(0, value))
    : 4.5;

  return (
    <span
      className="relative inline-block whitespace-nowrap leading-none text-[#767676]"
      aria-label={`${normalized.toFixed(1)} sao`}
      title={`${normalized.toFixed(1)} sao`}
    >
      <span aria-hidden="true">☆☆☆☆☆</span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-brand"
        style={{ width: `${(normalized / 5) * 100}%` }}
        aria-hidden="true"
      >
        ★★★★★
      </span>
    </span>
  );
}
