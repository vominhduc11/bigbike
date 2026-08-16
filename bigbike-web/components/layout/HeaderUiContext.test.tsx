import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HeaderUiProvider, useHeaderUi } from "@/components/layout/HeaderUiContext";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

const mockedUsePathname = vi.mocked(usePathname);

function PanelHarness() {
  const { activePanel, togglePanel } = useHeaderUi();

  return (
    <>
      <output data-testid="active-panel">{activePanel}</output>
      <button type="button" onClick={() => togglePanel("mobile-menu")}>Mở menu</button>
    </>
  );
}

describe("HeaderUiProvider", () => {
  let pathname = "/";

  beforeEach(() => {
    pathname = "/";
    mockedUsePathname.mockImplementation(() => pathname);
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  });

  it("đóng menu và mở lại cuộn trang sau khi địa chỉ thay đổi", async () => {
    const view = render(
      <HeaderUiProvider>
        <PanelHarness />
      </HeaderUiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở menu" }));
    expect(screen.getByTestId("active-panel")).toHaveTextContent("mobile-menu");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    pathname = "/dang-ky/";
    view.rerender(
      <HeaderUiProvider>
        <PanelHarness />
      </HeaderUiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("active-panel")).toHaveTextContent("none");
      expect(document.body.style.overflow).toBe("");
      expect(document.documentElement.style.overflow).toBe("");
    });
  });
});
