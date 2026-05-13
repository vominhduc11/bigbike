import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full min-h-[48px] px-4 py-3 border border-border rounded-none bg-white text-foreground font-body text-base font-normal leading-6 placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-[140ms] ease-[cubic-bezier(0.2,0,0,1)] hover:border-border/80 focus:border-ring focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,123,255,0.1)] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:bg-accent",
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
