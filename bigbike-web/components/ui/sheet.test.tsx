import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key === "close" ? "Đóng" : key,
}));

describe("Sheet close control", () => {
  it("keeps the compact icon inside a 44px keyboard and touch target", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Bộ lọc</SheetTitle>
          <SheetDescription>Chọn bộ lọc</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    const closeButton = screen.getByRole("button", { name: "Đóng" });
    expect(closeButton).toHaveClass("h-11", "w-11", "focus-visible:outline-2");
    expect(closeButton.querySelector("svg")).toHaveClass("h-5", "w-5");
  });
});
