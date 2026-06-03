type SaleBadgeProps = Readonly<{
  /** Discount percent (already validated > 0 by caller). */
  percent: number;
  /**
   * `ribbon` — WP triangle/pennant ribbon (article-page featured + PDP related cards).
   * `ticket` — ticket.svg badge with rotated text (category/archive cards).
   * `tilted` — rotated solid-brand block, no triangle (homepage featured carousel).
   */
  variant?: "ribbon" | "ticket" | "tilted";
}>;

/**
 * Shared product sale badge. Replaces the duplicated bb-fp-sale / product--item-sale
 * / bb-archive-product-sale markup that was repeated across ProductCard variants.
 */
export function SaleBadge({ percent, variant = "ribbon" }: SaleBadgeProps) {
  if (variant === "tilted") {
    return (
      <div className="absolute left-0 top-5 z-[2] h-8 w-20">
        <p className="relative m-0 w-auto -rotate-[20deg] bg-brand p-0 text-center font-display text-ui-18 font-semibold leading-7 text-white">
          {percent}%
        </p>
      </div>
    );
  }

  if (variant === "ticket") {
    return (
      <div className="absolute left-0 top-5 h-8 w-20 bg-[url('/wp/ticket.svg')] bg-left-top bg-no-repeat text-white">
        <p className="m-0 -rotate-[20deg] p-0 text-center font-cta text-ui-18 font-semibold leading-7 text-white">
          {percent}%
        </p>
      </div>
    );
  }

  return (
    <div className="absolute left-0 top-5 z-[2]">
      <p className="relative m-0 w-[70px] bg-brand text-center font-display text-base font-semibold leading-[42px] text-white after:absolute after:right-[-33px] after:top-0 after:h-0 after:w-0 after:border-b-0 after:border-l-[42px] after:border-r-[33px] after:border-t-[42px] after:border-l-transparent after:border-r-transparent after:border-t-brand after:content-['']">
        {percent}%
      </p>
    </div>
  );
}
