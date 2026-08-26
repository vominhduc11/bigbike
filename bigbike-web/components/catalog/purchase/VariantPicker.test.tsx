import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProductVariant } from "@/lib/contracts/public";
import { VariantPicker } from "./VariantPicker";

const variants = [
  {
    id: "variant-m",
    name: "M",
    options: [{ name: "Size", value: "M" }],
    stockState: "IN_STOCK",
    isAvailable: true,
  },
  {
    id: "variant-l",
    name: "L",
    options: [{ name: "Size", value: "L" }],
    stockState: "OUT_OF_STOCK",
    isAvailable: false,
  },
] as ProductVariant[];

describe("VariantPicker chat stock gate", () => {
  it("AC24/25: chat enables only variants that are actually available and in stock", () => {
    render(
      <VariantPicker
        variants={variants}
        attributeNames={["Size"]}
        selectedOptions={{}}
        onPick={vi.fn()}
        disableUnavailableOptions
      />,
    );

    expect(screen.getByRole("radio", { name: "M" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "L" })).toBeDisabled();
  });

  it("keeps the existing product-page browsing behavior when the chat-only gate is absent", () => {
    render(
      <VariantPicker
        variants={variants}
        attributeNames={["Size"]}
        selectedOptions={{}}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByRole("radio", { name: "L" })).toBeEnabled();
  });
});
