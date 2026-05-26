"use client";

import { cn } from "@/lib/utils";

/**
 * Shared quantity stepper — single horizontal control used everywhere a
 * customer changes an item count (PDP, cart). Buttons keep a 44px touch
 * height; the control is fully keyboard- and screen-reader accessible via
 * the `ariaLabel` on the number input.
 */
type QuantityStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  ariaLabel = "Số lượng",
  className,
}: QuantityStepperProps) {
  const clamp = (n: number) => {
    let v = n;
    if (v < min) v = min;
    if (max != null && v > max) v = max;
    return v;
  };

  const btnClass =
    "flex items-center justify-center w-9 min-h-[44px] text-lg leading-none text-foreground " +
    "transition-colors hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed " +
    "focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2";

  return (
    <div
      className={cn(
        "inline-flex items-stretch border border-border-control bg-white",
        disabled && "opacity-60",
        className,
      )}
    >
      <button
        type="button"
        className={btnClass}
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Giảm số lượng"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
        className={cn(
          "w-10 min-h-[44px] border-x border-border-control bg-transparent text-center",
          "font-bold text-sm text-foreground outline-none focus-visible:bg-secondary",
          "disabled:cursor-not-allowed",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        )}
      />
      <button
        type="button"
        className={btnClass}
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || (max != null && value >= max)}
        aria-label="Tăng số lượng"
      >
        +
      </button>
    </div>
  );
}
