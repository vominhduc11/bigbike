import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox touch target", () => {
  it("giữ ô vẽ 16px trong vùng bấm 44px và nhận thao tác từ nhãn", () => {
    render(
      <div>
        <Checkbox id="remember-test" touchTarget />
        <label htmlFor="remember-test">Ghi nhớ đăng nhập</label>
      </div>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" });
    expect(checkbox).toHaveClass("h-11", "w-11");
    expect(checkbox.firstElementChild).toHaveClass("h-4", "w-4");

    fireEvent.click(screen.getByText("Ghi nhớ đăng nhập"));
    expect(checkbox).toBeChecked();
  });
});
