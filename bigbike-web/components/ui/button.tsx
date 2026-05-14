import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: uppercase, Barlow Condensed, radius 0, min 44px touch target
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-8 py-4 border border-transparent font-cta text-base font-semibold uppercase tracking-normal transition-[background-color,border-color,color,transform] duration-[var(--bb-duration-fast)] ease-[var(--bb-ease-standard)] cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60 hover:not-disabled:scale-[1.02]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground border-primary hover:bg-brand-hover hover:border-brand-hover active:bg-brand-active active:border-brand-active",
        secondary:
          "bg-white text-primary border-2 border-primary hover:bg-accent hover:border-brand-hover",
        outline:
          "bg-transparent text-blue border-blue hover:bg-blue/10 hover:border-info",
        dark: "bg-black text-white border-black hover:bg-primary hover:border-primary",
        ghost:
          "bg-transparent text-foreground border-transparent hover:bg-secondary",
        link: "bg-transparent text-blue underline underline-offset-4 border-transparent px-0 py-0 min-h-0 hover:text-primary",
        destructive:
          "bg-destructive text-destructive-foreground border-destructive hover:opacity-90",
      },
      size: {
        sm: "min-h-[36px] px-4 py-2 text-sm",
        md: "min-h-[44px] px-8 py-4 text-base",
        lg: "min-h-[52px] px-10 py-4 text-lg",
        icon: "min-h-[44px] w-[44px] px-0 py-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
