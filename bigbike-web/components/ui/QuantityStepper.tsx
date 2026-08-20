"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onValueChange: (value: number) => void;
  onBlur?: () => void;
  decreaseLabel: string;
  increaseLabel: string;
  inputLabel: string;
  inputId?: string;
  disabled?: boolean;
  decreaseDisabled?: boolean;
  variant: "pdp" | "cart";
};

/** Shared behaviour for the PDP and cart quantity controls. */
export function QuantityStepper({
  value,
  onDecrease,
  onIncrease,
  onValueChange,
  onBlur,
  decreaseLabel,
  increaseLabel,
  inputLabel,
  inputId,
  disabled = false,
  decreaseDisabled = false,
  variant,
}: QuantityStepperProps) {
  const isPdp = variant === "pdp";
  const buttonClass = isPdp
    ? "h-13! w-11! rounded-none border-0 hover:bg-muted"
    : "h-11! w-11! rounded-none";
  const inputClass = isPdp
    ? "h-13! min-h-0 w-full min-w-0 flex-1 rounded-none border-y-0 border-x border-border-control px-1 py-0 text-center text-a2-page font-semibold [appearance:textfield] focus:shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    : "h-11! min-h-0 w-14 rounded-none border-y-0 border-x px-1 py-0 text-center [appearance:textfield] focus:shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <div className={cn(isPdp ? "flex flex-1 items-stretch border border-border-control" : "inline-flex shrink-0 border border-border-control")}>
      <Button type="button" variant="ghost" size="icon" className={buttonClass} onClick={onDecrease} disabled={disabled || decreaseDisabled} aria-label={decreaseLabel}>
        <Minus className="h-4 w-4" aria-hidden />
      </Button>
      <Input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={value}
        onChange={(event) => onValueChange(Number(event.target.value))}
        onBlur={onBlur}
        disabled={disabled}
        aria-label={inputLabel}
        className={inputClass}
      />
      <Button type="button" variant="ghost" size="icon" className={buttonClass} onClick={onIncrease} disabled={disabled} aria-label={increaseLabel}>
        <Plus className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
