import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { VnAddressFields } from "./VnAddressFields";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("VnAddressFields", () => {
  it("lấy nhãn và placeholder qua i18n", () => {
    render(
      <VnAddressFields
        value={{ province: "", ward: "" }}
        onChange={vi.fn()}
        required
      />,
    );

    expect(screen.getByText("provinceLabel")).toBeInTheDocument();
    expect(screen.getByText("provincePlaceholder")).toBeInTheDocument();
    expect(screen.getByText("wardLabel")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("provinceFirstPlaceholder")).toBeInTheDocument();
  });
});
