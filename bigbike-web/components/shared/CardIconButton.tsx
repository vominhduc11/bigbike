"use client";

import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardIconButtonProps = {
  active: boolean;
  ariaLabel: string;
  /** Vertical offset utility, e.g. "top-[10px]" — passed verbatim. */
  top: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  ariaPressed?: boolean;
  /** Extra utilities appended via cn() (e.g. "cursor-pointer"). */
  className?: string;
  children: ReactNode;
};

/**
 * Circular icon button overlaid on a product card (wishlist / compare). The
 * glyph is passed as children. Per-site differences — vertical offset, disabled,
 * aria-pressed, and extra classes — are explicit props so each caller's rendered
 * output is preserved exactly (only the non-semantic Tailwind token order in the
 * className string is normalised).
 */
export function CardIconButton({
  active,
  ariaLabel,
  top,
  onClick,
  disabled,
  ariaPressed,
  className,
  children,
}: CardIconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "bb-round absolute right-[10px] z-[3] flex h-[34px] w-[34px] items-center justify-center rounded-full border p-0 transition-colors duration-300",
        top,
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-border bg-white/95 text-muted-foreground hover:border-brand hover:bg-white hover:text-brand",
        className,
      )}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
