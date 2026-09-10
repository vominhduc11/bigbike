import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MobileStickyPurchaseBar } from "./MobileStickyPurchaseBar";

describe("MobileStickyPurchaseBar", () => {
  let height = 77;
  let resize: () => void = () => {};
  let intersect: IntersectionObserverCallback = () => {};
  const resizeDisconnect = vi.fn();
  const intersectionDisconnect = vi.fn();

  beforeEach(() => {
    height = 77;
    resizeDisconnect.mockReset();
    intersectionDisconnect.mockReset();
    document.documentElement.style.setProperty("--bb-pdp-sticky-height", "64px");

    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect = resizeDisconnect;
      },
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersect = callback;
        }
        observe() {}
        disconnect = intersectionDisconnect;
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ height }) as DOMRect,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty("--bb-pdp-sticky-height");
  });

  it("đồng bộ chiều cao thực để toast và nút nổi chừa đúng khoảng trống", () => {
    const view = render(
      <>
        <div data-purchase-actions />
        <button type="button" data-purchase-add />
        <MobileStickyPurchaseBar addToCartLabel="Thêm vào giỏ" zaloLabel="Tư vấn Zalo" />
      </>,
    );

    expect(document.documentElement.style.getPropertyValue("--bb-pdp-sticky-height")).toBe("77px");

    height = 96;
    act(() => resize());
    expect(document.documentElement.style.getPropertyValue("--bb-pdp-sticky-height")).toBe("96px");

    act(() =>
      intersect(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(view.container.querySelector(".bb-pdp-sticky-cta")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    view.unmount();
    expect(document.documentElement.style.getPropertyValue("--bb-pdp-sticky-height")).toBe("64px");
    expect(resizeDisconnect).toHaveBeenCalled();
    expect(intersectionDisconnect).toHaveBeenCalled();
  });
});
