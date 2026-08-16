"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

type SliderThumbProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Thumb>;

export type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  /** Number of handles to render when the caller does not compose thumbs itself. */
  thumbCount?: number;
  /** Per-handle accessible props, including localized aria labels/value text. */
  thumbProps?: SliderThumbProps[];
  /** Styling hooks for the track and selected range without replacing the Radix primitive. */
  trackClassName?: string;
  rangeClassName?: string;
  /** Optional classes for the small visual indicator inside each 44px hit area. */
  thumbIndicatorClassName?: string[];
};

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, thumbCount, thumbProps, trackClassName, rangeClassName, thumbIndicatorClassName, value, defaultValue, min = 0, max = 100, ...props }, ref) => {
  const count = thumbCount ?? value?.length ?? defaultValue?.length ?? 1;
  const values = value ?? defaultValue ?? [];

  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn("relative h-1 w-full grow overflow-hidden rounded-none bg-muted", trackClassName)}
      >
        <SliderPrimitive.Range className={cn("absolute h-full bg-primary", rangeClassName)} />
      </SliderPrimitive.Track>
      {Array.from({ length: Math.max(1, count) }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          {...thumbProps?.[index]}
          className={cn(
            "flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0 shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            thumbProps?.[index]?.className,
          )}
        >
          <span
            aria-hidden="true"
            data-slider-thumb-indicator="true"
            className={cn(
              "block h-4 w-4 !rounded-full border-2 border-brand bg-background shadow-sm",
              thumbIndicatorClassName?.[index],
            )}
            style={{
              transform: values[index] != null && values[index] <= min
                ? "translateX(-50%)"
                : values[index] != null && values[index] >= max
                  ? "translateX(50%)"
                  : undefined,
            }}
          />
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
