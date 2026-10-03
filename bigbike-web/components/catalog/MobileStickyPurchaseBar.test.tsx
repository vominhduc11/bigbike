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

    view.unmount();
    expect(document.documentElement.style.getPropertyValue("--bb-pdp-sticky-height")).toBe("64px");
    expect(resizeDisconnect).toHaveBeenCalled();
    expect(intersectionDisconnect).toHaveBeenCalled();
  });

  it("chỉ hiện sau khi vùng mua hàng đã đi qua phía trên màn hình", () => {
    const view = render(
      <>
        <div data-purchase-actions />
        <button type="button" data-purchase-add />
        <MobileStickyPurchaseBar addToCartLabel="Thêm vào giỏ" zaloLabel="Tư vấn Zalo" />
      </>,
    );
    const sticky = view.container.querySelector(".bb-pdp-sticky-cta");

    expect(sticky).toHaveAttribute("aria-hidden", "true");

    act(() =>
      intersect(
        [
          {
            isIntersecting: false,
            boundingClientRect: { top: 900, bottom: 956 },
            rootBounds: { top: 0 },
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    );
    expect(sticky).toHaveAttribute("aria-hidden", "true");

    act(() =>
      intersect(
        [
          {
            isIntersecting: true,
            boundingClientRect: { top: 120, bottom: 176 },
            rootBounds: { top: 0 },
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    );
    expect(sticky).toHaveAttribute("aria-hidden", "true");

    act(() =>
      intersect(
        [
          {
            isIntersecting: false,
            boundingClientRect: { top: -80, bottom: -24 },
            rootBounds: { top: 0 },
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    );
    expect(sticky).toHaveAttribute("aria-hidden", "false");

    act(() =>
      intersect(
        [
          {
            isIntersecting: true,
            boundingClientRect: { top: -20, bottom: 36 },
            rootBounds: { top: 0 },
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    );
    expect(sticky).toHaveAttribute("aria-hidden", "true");
  });

  it("giữ tỷ lệ 60/40 và để Zalo chiếm toàn hàng khi hết hàng", () => {
    const { container, rerender } = render(
      <>
        <div data-purchase-actions />
        <button type="button" data-purchase-add />
        <MobileStickyPurchaseBar addToCartLabel="Thêm vào giỏ" zaloLabel="Tư vấn Zalo" />
      </>,
    );

    expect(container.querySelector("[data-sticky-purchase-add]")).toHaveClass("flex-[3]");
    expect(container.querySelector("[data-sticky-zalo]")).toHaveClass("flex-[2]");
    expect(container.querySelectorAll("[data-sticky-purchase-label]")).toHaveLength(2);

    rerender(
      <>
        <div data-purchase-actions />
        <button type="button" data-purchase-add />
        <MobileStickyPurchaseBar addToCartLabel="Thêm vào giỏ" zaloLabel="Tư vấn Zalo" outOfStock />
      </>,
    );
    expect(container.querySelector("[data-sticky-purchase-add]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-sticky-zalo]")).toHaveClass("flex-[2]");
  });
});
