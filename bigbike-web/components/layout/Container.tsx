import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** Shared desktop content canvas used inside viewport-wide surfaces. */
export const SITE_CANVAS_CLASS = "mx-auto w-full max-w-[var(--bb-desktop-canvas)]";

/**
 * Shared content rail (replaces the legacy `.bb-container` class).
 *
 * The base "default" rail is the effective merge of the brand-tokens fluid rail
 * and the ≤767 mobile reset: full-width with `--bb-mobile-page-x` padding on
 * mobile, then a centered `min(100% - 2·padding, --bb-container-xl)` rail from
 * 768px up (desktop padding from 992px). `--bb-container-xl` stays fixed at
 * 1200px so wider viewports do not resize page content.
 *
 * The "blog" variant reproduces `.bb-blog-listing-parity .bb-container`
 * (full-width up to the fixed 1200px rail, 15px padding).
 *
 * Emits `data-bb-rail` so the few structural CSS rules that must stay
 * (page-head banner `> header:first-child`, compare-page head, article-detail
 * footer) can still target it without the legacy class.
 */
const RAIL = {
  default:
    "mx-auto w-full max-w-none px-[var(--bb-mobile-page-x)] " +
    "md:px-0 md:max-w-none md:w-[min(100%_-_calc(var(--bb-page-padding-tablet)_*_2),var(--bb-container-xl))] " +
    "min-[992px]:w-[min(100%_-_calc(var(--bb-page-padding-desktop)_*_2),var(--bb-container-xl))]",
  blog:
    "mx-auto w-full max-w-none px-[var(--bb-mobile-page-x)] " +
    "md:px-[15px] md:max-w-300",
} as const;

type ContainerProps = ComponentPropsWithoutRef<"div"> & {
  variant?: keyof typeof RAIL;
};

export function Container({ variant = "default", className, ...props }: ContainerProps) {
  return <div data-bb-rail className={cn(RAIL[variant], className)} {...props} />;
}
