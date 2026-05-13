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
          "bg-[rgba(119,136,102,0.14)] text-[#778866] border border-[rgba(119,136,102,0.34)]",
        "stock-low": "bg-[#fcb900] text-black",
        "stock-out": "bg-primary text-primary-foreground",
        preorder: "bg-info text-info-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        info: "bg-info/10 text-info border border-info/30",
        warning: "bg-[#fcb900]/20 text-[#7a5800] border border-[#fcb900]/40",
        success: "bg-[rgba(119,136,102,0.14)] text-[#778866] border border-[rgba(119,136,102,0.34)]",
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
