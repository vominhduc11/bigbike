import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex w-full min-h-[120px] px-4 py-3 border border-border rounded-none bg-white text-foreground font-body text-base font-normal leading-6 placeholder:text-muted-foreground resize-y transition-[border-color,box-shadow] duration-[140ms] focus:border-ring focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,123,255,0.1)] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:bg-accent",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
