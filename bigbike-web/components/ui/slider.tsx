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
  /** Positions the visible indicator on the track while keeping the 44px thumb hit area. */
  thumbIndicatorMode?: "thumb" | "track";
};

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, thumbCount, thumbProps, trackClassName, rangeClassName, thumbIndicatorClassName, thumbIndicatorMode = "thumb", value, defaultValue, min = 0, max = 100, ...props }, ref) => {
  const count = thumbCount ?? value?.length ?? defaultValue?.length ?? 1;
  const values = value ?? defaultValue ?? [];
  const indicatorLeft = (thumbValue: number | undefined) => {
    if (thumbValue == null || max <= min) return undefined;
    const position = Math.min(1, Math.max(0, (thumbValue - min) / (max - min)));
    return `clamp(0px, calc(${position * 100}% - 0.5rem), calc(100% - 1rem))`;
  };
  const indicatorClassName = (index: number) => cn(
    "block h-4 w-4 !rounded-full border-2 border-brand bg-background shadow-sm",
    thumbIndicatorClassName?.[index],
  );

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
        data-slider-track="true"
        className={cn("relative h-1 w-full grow overflow-hidden rounded-none bg-muted", trackClassName)}
      >
        <SliderPrimitive.Range
          data-slider-range="true"
          className={cn("absolute h-full bg-primary", rangeClassName)}
        />
      </SliderPrimitive.Track>
      {thumbIndicatorMode === "track" ? Array.from({ length: Math.max(1, count) }, (_, index) => {
        const left = indicatorLeft(values[index]);
        if (left == null) return null;
        return (
          <span
            key={`track-indicator-${index}`}
            aria-hidden="true"
            data-slider-thumb-indicator="true"
            data-slider-thumb-indicator-index={index}
            className={cn(
              "pointer-events-none absolute top-1/2 z-20 h-4 w-4 -translate-y-1/2",
              indicatorClassName(index),
            )}
            style={{ left }}
          />
        );
      }) : null}
      {Array.from({ length: Math.max(1, count) }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          {...thumbProps?.[index]}
          className={cn(
            "flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0 shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            thumbProps?.[index]?.className,
          )}
        >
          {thumbIndicatorMode === "thumb" ? (
            <span
              aria-hidden="true"
              data-slider-thumb-indicator="true"
              data-slider-thumb-indicator-index={index}
              className={indicatorClassName(index)}
              style={{
                transform: values[index] != null && values[index] <= min
                  ? "translateX(-50%)"
                  : values[index] != null && values[index] >= max
                    ? "translateX(50%)"
                    : undefined,
              }}
            />
          ) : null}
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
