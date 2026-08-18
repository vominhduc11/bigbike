"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  /** Keep the visual box compact while exposing a 44×44px pointer target. */
  touchTarget?: boolean;
};

const VISUAL_BOX =
  "flex h-4 w-4 items-center justify-center rounded-none border border-border-control bg-white text-transparent transition-colors";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, touchTarget = false, ...props }, ref) => {
  if (touchTarget) {
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
          "peer group flex h-11 w-11 shrink-0 items-center justify-center bg-transparent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            VISUAL_BOX,
            "group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground",
          )}
        >
          <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
            <Check className="h-3.5 w-3.5" />
          </CheckboxPrimitive.Indicator>
        </span>
      </CheckboxPrimitive.Root>
    );
  }

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-none border border-border-control bg-white transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-3.5 w-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
