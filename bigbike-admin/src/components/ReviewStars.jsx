// REVIEW_RULE_008: rating có thể là nửa sao (VD 4.5) — tô theo tỷ lệ liên tục,
// không Math.round về sao nguyên. Overlay hàng sao tô màu clip theo % chiều rộng
// trên nền hàng sao rỗng (mirror bigbike-web components/ui/RatingStars.tsx).
export function ReviewStars({ rating, label, className = '' }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0))
  return (
    <span
      className={`relative inline-flex leading-none ${className}`}
      role="img"
      aria-label={label || `${value.toFixed(1)}/5`}
    >
      <span className="inline-flex gap-px text-muted-foreground" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index}>★</span>
        ))}
      </span>
      <span
        className="absolute inset-0 inline-flex gap-px overflow-hidden text-warning"
        style={{ width: `${(value / 5) * 100}%` }}
        aria-hidden="true"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index}>★</span>
        ))}
      </span>
    </span>
  )
}
