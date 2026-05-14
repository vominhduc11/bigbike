import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 min-h-[24px] px-2 py-1 rounded-none font-body text-xs font-bold leading-[12px] uppercase tracking-normal",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground border border-border",
        primary: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "bg-transparent text-foreground border border-border",
        sale: "bg-primary text-primary-foreground",
        "stock-in":
          "bg-[var(--bb-state-success-bg)] text-[var(--bb-state-success-text)] border border-[var(--bb-state-success-border)]",
        "stock-low": "bg-[var(--bb-state-warning)] text-foreground",
        "stock-out": "bg-primary text-primary-foreground",
        preorder: "bg-info text-info-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        info: "bg-info/10 text-info border border-info/30",
        warning:
          "bg-[var(--bb-state-warning-bg)] text-[var(--bb-state-warning-text)] border border-[var(--bb-state-warning-border)]",
        success:
          "bg-[var(--bb-state-success-bg)] text-[var(--bb-state-success-text)] border border-[var(--bb-state-success-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
