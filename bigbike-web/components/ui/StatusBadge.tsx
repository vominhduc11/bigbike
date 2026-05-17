import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared status badge for order / return / fulfillment states.
 *
 * Every surface that shows a workflow status (order history, return
 * requests, order detail) renders through this component so the colour
 * language is identical site-wide. Tones map only to brand state tokens
 * (`--bb-state-*`) — no per-screen hex.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  success:
    "bg-[var(--bb-state-success-bg)] text-[var(--bb-state-success-text)] border-[var(--bb-state-success-border)]",
  warning:
    "bg-[var(--bb-state-warning-bg)] text-[var(--bb-state-warning-text)] border-[var(--bb-state-warning-border)]",
  danger:
    "bg-[var(--bb-state-danger-bg)] text-destructive border-[var(--bb-state-danger-border)]",
  info:
    "bg-[rgba(0,123,255,0.12)] text-info border-[rgba(0,123,255,0.32)]",
  neutral:
    "bg-[var(--bb-bg-surface-raised)] text-muted-foreground border-border",
};

type StatusBadgeProps = {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
};

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-block border font-bold uppercase text-xs leading-none tracking-[0.1em] py-[5px] px-[10px]",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
