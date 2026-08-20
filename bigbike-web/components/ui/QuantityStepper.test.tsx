import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuantityStepper } from "./QuantityStepper";

describe("QuantityStepper", () => {
  it("locks decrease at the minimum and forwards direct input", () => {
    const onValueChange = vi.fn();
    render(<QuantityStepper variant="cart" value={1} onDecrease={vi.fn()} onIncrease={vi.fn()} onValueChange={onValueChange} decreaseLabel="decrease" increaseLabel="increase" inputLabel="quantity" decreaseDisabled />);
    expect(screen.getByRole("button", { name: "decrease" })).toBeDisabled();
    fireEvent.change(screen.getByRole("spinbutton", { name: "quantity" }), { target: { value: "3" } });
    expect(onValueChange).toHaveBeenCalledWith(3);
  });

  it("locks all controls while an update is in progress", () => {
    render(<QuantityStepper variant="pdp" value={2} onDecrease={vi.fn()} onIncrease={vi.fn()} onValueChange={vi.fn()} decreaseLabel="decrease" increaseLabel="increase" inputLabel="quantity" disabled />);
    expect(screen.getByRole("button", { name: "increase" })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "quantity" })).toBeDisabled();
  });
});
