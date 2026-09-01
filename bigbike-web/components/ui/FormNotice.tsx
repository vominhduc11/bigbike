import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormNoticeTone = "success" | "danger" | "warning";

type FormNoticeProps = HTMLAttributes<HTMLDivElement> & {
  tone: FormNoticeTone;
  /** Extra utilities (margin, padding override, …) appended via cn(). */
  className?: string;
  children: ReactNode;
};

const TONE_CLASS: Record<FormNoticeTone, string> = {
  success: "bg-state-success-bg border-state-success-border text-state-success-text",
  danger: "bg-state-danger-bg border-state-danger-border text-destructive",
  warning: "bg-state-warning-bg border-state-warning-border text-state-warning-text",
};

/**
 * Status banner for account / return forms. The tone supplies the
 * background/border/text colour; the default padding follows the account form
 * spacing and callers can pass compatible HTML accessibility attributes.
 */
export function FormNotice({ tone, className, children, ...props }: FormNoticeProps) {
  return (
    <div className={cn("border p-3 text-a5-meta", TONE_CLASS[tone], className)} {...props}>
      {children}
    </div>
  );
}
