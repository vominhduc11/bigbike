import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormNoticeTone = "success" | "danger" | "warning";

type FormNoticeProps = {
  tone: FormNoticeTone;
  /** Extra utilities (margin, padding override, …) appended via cn(). */
  className?: string;
  children: ReactNode;
};

const TONE_CLASS: Record<FormNoticeTone, string> = {
  success: "bg-[var(--bb-state-success-bg)] border-[var(--bb-state-success-border)] text-state-success-text",
  danger: "bg-[var(--bb-state-danger-bg)] border-[var(--bb-state-danger-border)] text-destructive",
  warning: "bg-[var(--bb-state-warning-bg)] border-[var(--bb-state-warning-border)] text-state-warning-text",
};

/**
 * Status banner for account / return forms. The tone supplies the
 * background/border/text colour; the default padding matches the account &
 * address forms (`p-[12px_16px]`) and is overridable via `className` (callers
 * that need different padding/margin pass it, and tailwind-merge resolves the
 * conflict). Children render as-is — callers that wrap content in a `<p>` keep
 * doing so.
 *
 * Note: like the originals, this renders a plain `<div>` with no role/aria-live;
 * adding one would change the existing markup, so it is intentionally omitted.
 */
export function FormNotice({ tone, className, children }: FormNoticeProps) {
  return (
    <div className={cn("border p-[12px_16px] text-sm", TONE_CLASS[tone], className)}>
      {children}
    </div>
  );
}
