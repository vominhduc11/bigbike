import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ProductVariant } from "@/lib/contracts/public";
import viMessages from "@/messages/vi.json";
import enMessages from "@/messages/en.json";
import { VariantPicker } from "./VariantPicker";

function withLocale(ui: ReactNode, locale: "vi" | "en" = "vi") {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "vi" ? viMessages : enMessages}
      timeZone="Asia/Ho_Chi_Minh"
    >
      {ui}
    </NextIntlClientProvider>
  );
}

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
      withLocale(
        <VariantPicker
          variants={variants}
          attributeNames={["Size"]}
          selectedOptions={{}}
          onPick={vi.fn()}
          disableUnavailableOptions
        />,
      ),
    );

    expect(screen.getByRole("radio", { name: "M" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "L" })).toBeDisabled();
  });

  it("keeps the existing product-page browsing behavior when the chat-only gate is absent", () => {
    render(
      withLocale(
        <VariantPicker
          variants={variants}
          attributeNames={["Size"]}
          selectedOptions={{}}
          onPick={vi.fn()}
        />,
      ),
    );

    expect(screen.getByRole("radio", { name: "L" })).toBeEnabled();
  });
});

describe("VariantPicker localized size label", () => {
  it.each(["Size", "Kích cỡ"])(
    "translates the heading and accessible label, preserving the %s selection key",
    (attributeName) => {
      const onPick = vi.fn();
      const productVariants = [
        { ...variants[0], options: [{ name: attributeName, value: "BXL" }] },
        { ...variants[0], id: "variant-xl", options: [{ name: attributeName, value: "XL" }] },
      ];
      const picker = (
        <VariantPicker
          variants={productVariants}
          attributeNames={[attributeName]}
          selectedOptions={{ [attributeName]: "BXL" }}
          onPick={onPick}
        />
      );
      const { rerender } = render(withLocale(picker, "vi"));
      for (const locale of ["vi", "en", "vi"] as const) {
        rerender(withLocale(picker, locale));
        const label = locale === "vi" ? "Kích cỡ" : "Size";
        expect(screen.getByText(label, { selector: "p" })).toBeInTheDocument();
        expect(screen.getByRole("radiogroup", { name: label })).toBeInTheDocument();
        expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
          "BXL",
          "XL",
        ]);
        expect(screen.getByRole("radio", { name: "BXL", checked: true })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("radio", { name: "XL" }));
        expect(onPick).toHaveBeenLastCalledWith(attributeName, "XL");
      }
    },
  );

  it.each(["vi", "en"] as const)("keeps unrelated attribute labels unchanged (%s)", (locale) => {
    const otherVariants = [{ ...variants[0], options: [{ name: "Pack size", value: "2" }] }];
    render(
      withLocale(
        <VariantPicker
          variants={otherVariants}
          attributeNames={["Pack size"]}
          selectedOptions={{}}
          onPick={vi.fn()}
        />,
        locale,
      ),
    );
    expect(screen.getByRole("radiogroup", { name: "Pack size" })).toBeInTheDocument();
    expect(screen.getByText("Pack size", { selector: "p" })).toBeInTheDocument();
  });
});

describe("VariantPicker localized gender labels", () => {
  it.each(["Gender", "Giới tính", " GIỚI TÍNH "])(
    "translates %s and its choices without changing raw selection values",
    (attributeName) => {
      const onPick = vi.fn();
      const productVariants = ["Nam", "Nữ"].map((value, index) => ({
        ...variants[index],
        options: [{ name: attributeName, value }],
      }));
      const picker = (
        <VariantPicker
          variants={productVariants}
          attributeNames={[attributeName]}
          selectedOptions={{ [attributeName]: "Nữ" }}
          onPick={onPick}
        />
      );
      const { rerender } = render(withLocale(picker));
      for (const locale of ["vi", "en", "vi"] as const) {
        rerender(withLocale(picker, locale));
        const heading = locale === "vi" ? "Giới tính" : "Gender";
        const male = locale === "vi" ? "Nam" : "Male";
        const female = locale === "vi" ? "Nữ" : "Female";
        expect(screen.getByText(heading, { selector: "p" })).toBeInTheDocument();
        expect(screen.getByRole("radiogroup", { name: heading })).toBeInTheDocument();
        const selected = screen.getByRole("radio", { name: female, checked: true });
        expect(selected).toHaveAttribute("value", "Nữ");
        expect(selected).toHaveClass("min-w-13");
        expect(selected).toBeEnabled();
        fireEvent.click(screen.getByRole("radio", { name: male }));
        expect(onPick).toHaveBeenLastCalledWith(attributeName, "Nam");
        fireEvent.click(selected);
        expect(onPick).toHaveBeenLastCalledWith(attributeName, "Nữ");
      }
    },
  );

  it.each(["vi", "en"] as const)(
    "keeps the chat stock gate and English raw values (%s)",
    (locale) => {
      const onPick = vi.fn();
      render(
        withLocale(
          <VariantPicker
            variants={["Male", "Female"].map((value, index) => ({
              ...variants[index],
              options: [{ name: "Gender", value }],
            }))}
            attributeNames={["Gender"]}
            selectedOptions={{}}
            onPick={onPick}
            disableUnavailableOptions
          />,
          locale,
        ),
      );
      const male = screen.getByRole("radio", { name: locale === "vi" ? "Nam" : "Male" });
      expect(male).toBeEnabled();
      fireEvent.click(male);
      expect(onPick).toHaveBeenCalledWith("Gender", "Male");
      expect(screen.getByRole("radio", { name: locale === "vi" ? "Nữ" : "Female" })).toBeDisabled();
    },
  );

  it.each(["vi", "en"] as const)(
    "preserves unknown gender values and unrelated attributes (%s)",
    (locale) => {
      render(
        withLocale(
          <VariantPicker
            variants={[
              {
                ...variants[0],
                options: [
                  { name: "Gender", value: "Custom fit" },
                  { name: "Model", value: "Nam" },
                ],
              },
            ]}
            attributeNames={["Gender", "Model"]}
            selectedOptions={{}}
            onPick={vi.fn()}
          />,
          locale,
        ),
      );
      expect(screen.getByRole("radio", { name: "Custom fit" })).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Model" })).toHaveTextContent("Nam");
    },
  );
});

describe("VariantPicker localized color headings", () => {
  it.each(["vi", "en"] as const)(
    "translates legacy headings, not commercial color values (%s)",
    (locale) => {
      const onPick = vi.fn();
      render(
        withLocale(
          <VariantPicker
            variants={[{ ...variants[0], options: [{ name: "màu sắc", value: "Đen nhám" }] }]}
            attributeNames={["màu sắc"]}
            selectedOptions={{}}
            onPick={onPick}
          />,
          locale,
        ),
      );
      expect(
        screen.getByRole("radiogroup", { name: locale === "vi" ? "Màu sắc" : "Color" }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("radio", { name: "Đen nhám" }));
      expect(onPick).toHaveBeenCalledWith("màu sắc", "Đen nhám");
    },
  );

  it("uses the English accessibility label for a color swatch without changing its raw value", () => {
    const onPick = vi.fn();
    render(
      withLocale(
        <VariantPicker
          variants={[
            {
              ...variants[0],
              options: [
                {
                  name: "Màu sắc",
                  value: "XANH NHẠT",
                  accessibilityLabel: "Light Blue",
                },
              ],
            },
          ]}
          attributeNames={["Màu sắc"]}
          selectedOptions={{}}
          onPick={onPick}
        />,
        "en",
      ),
    );

    const swatch = screen.getByRole("radio", { name: "Light Blue" });
    expect(swatch).toHaveAttribute("value", "XANH NHẠT");
    expect(swatch).toHaveClass("size-13");
    fireEvent.click(swatch);
    expect(onPick).toHaveBeenCalledWith("Màu sắc", "XANH NHẠT");
  });

  it("falls back to the stored Vietnamese color value when no display label is supplied", () => {
    render(
      withLocale(
        <VariantPicker
          variants={[{ ...variants[0], options: [{ name: "Màu sắc", value: "CYBORG BLUE" }] }]}
          attributeNames={["Màu sắc"]}
          selectedOptions={{}}
          onPick={vi.fn()}
        />,
        "en",
      ),
    );

    expect(screen.getByRole("radio", { name: "CYBORG BLUE" })).toBeInTheDocument();
  });
});

describe("VariantPicker long text choices", () => {
  it("widens long labels on one line while choices stay on one swipeable row", () => {
    const onPick = vi.fn();
    const values = ["M8-3 thuận", "M8-3 nghịch", "M10-5 nghịch"];
    render(
      withLocale(
        <VariantPicker
          variants={values.map((value, index) => ({
            ...variants[0],
            id: `variant-bolt-${index}`,
            options: [{ name: "Cỡ ốc", value }],
          }))}
          attributeNames={["Cỡ ốc"]}
          selectedOptions={{}}
          onPick={onPick}
        />,
      ),
    );
    // Owner chốt 2026-09-19: nhiều ô vẫn nằm một hàng, khách vuốt ngang để xem tiếp.
    expect(screen.getByRole("radiogroup", { name: "Cỡ ốc" })).toHaveClass(
      "flex-nowrap",
      "overflow-x-auto",
    );
    for (const value of values) {
      const option = screen.getByRole("radio", { name: value });
      expect(option).toHaveClass("h-13", "min-w-13", "whitespace-nowrap", "px-2");
      expect(option).not.toHaveClass("size-13");
    }
    fireEvent.click(screen.getByRole("radio", { name: "M10-5 nghịch" }));
    expect(onPick).toHaveBeenCalledWith("Cỡ ốc", "M10-5 nghịch");
  });

  it("keeps color swatches square", () => {
    render(
      withLocale(
        <VariantPicker
          variants={[{ ...variants[0], options: [{ name: "Màu sắc", value: "Đen nhám" }] }]}
          attributeNames={["Màu sắc"]}
          selectedOptions={{}}
          onPick={vi.fn()}
        />,
      ),
    );
    const swatch = screen.getByRole("radio", { name: "Đen nhám" });
    expect(swatch).toHaveClass("size-13");
    expect(swatch).not.toHaveClass("min-w-13");
  });
});
