import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full min-h-[48px] px-4 py-3 border border-border-control rounded-none bg-white text-foreground font-body text-base font-normal leading-6 placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-[var(--bb-duration-fast)] ease-[var(--bb-ease-standard)] hover:border-border-control-hover focus:border-ring focus:outline-none focus:shadow-[var(--bb-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:bg-accent",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
