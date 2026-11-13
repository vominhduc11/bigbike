import { StrictMode, useEffect } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-TESTDEV500" as string | undefined,
}));
vi.mock("@/env", () => ({ env: config }));
import { trackReviewLinkOpen } from "@/lib/analytics";
function callback() {
  return (
    vi.mocked(window.gtag!).mock.calls.find((call) => call[1] === "review_link_open")![2] as {
      event_callback: () => void;
    }
  ).event_callback;
}
beforeEach(() => {
  vi.useFakeTimers();
  config.NEXT_PUBLIC_GA4_MEASUREMENT_ID = "G-TESTDEV500";
  window.gtag = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  delete window.gtag;
  delete window.clarity;
});
describe("Google review opening", () => {
  it("sends once with original UTM, beacon and bounded callback; no manual page_view", () => {
    window.history.replaceState(
      {},
      "",
      "/danh-gia/?utm_source=qr&utm_medium=offline&utm_campaign=qr-danh-gia",
    );
    const done = vi.fn();
    trackReviewLinkOpen(done);
    vi.advanceTimersByTime(0);
    expect(window.gtag).toHaveBeenCalledExactlyOnceWith(
      "event",
      "review_link_open",
      expect.objectContaining({
        page_location: window.location.href,
        send_to: "G-TESTDEV500",
        transport_type: "beacon",
        event_timeout: 750,
      }),
    );
    callback()();
    callback()();
    vi.advanceTimersByTime(2000);
    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("falls back at 800 ms and ignores late callbacks", () => {
    const done = vi.fn();
    trackReviewLinkOpen(done);
    vi.advanceTimersByTime(799);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    callback()();
    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("waits for initialization without resetting its deadline", () => {
    delete window.gtag;
    const done = vi.fn();
    trackReviewLinkOpen(done);
    vi.advanceTimersByTime(400);
    window.gtag = vi.fn();
    vi.advanceTimersByTime(25);
    expect(window.gtag).toHaveBeenCalledExactlyOnceWith(
      "event",
      "review_link_open",
      expect.objectContaining({ event_timeout: 325 }),
    );
    vi.advanceTimersByTime(375);
    expect(done).toHaveBeenCalledOnce();
  });
  it.each(["blocked", "unconfigured"])("still completes with GA4 %s", (mode) => {
    if (mode === "blocked") delete window.gtag;
    else config.NEXT_PUBLIC_GA4_MEASUREMENT_ID = undefined;
    const done = vi.fn();
    trackReviewLinkOpen(done);
    vi.advanceTimersByTime(800);
    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not send after the budget", () => {
    delete window.gtag;
    const done = vi.fn();
    trackReviewLinkOpen(done);
    vi.advanceTimersByTime(800);
    window.gtag = vi.fn();
    vi.advanceTimersByTime(100);
    expect(window.gtag).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledOnce();
  });
  it("handles a throwing library", () => {
    window.gtag = vi.fn(() => {
      throw new Error("blocked");
    });
    const done = vi.fn();
    trackReviewLinkOpen(done);
    vi.advanceTimersByTime(0);
    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("unmount cancels polling/deadline and late callbacks", () => {
    const done = vi.fn();
    const cancel = trackReviewLinkOpen(done);
    vi.advanceTimersByTime(0);
    const complete = callback();
    cancel();
    complete();
    vi.advanceTimersByTime(1000);
    expect(done).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cleanup before initialization cancels both timers", () => {
    delete window.gtag;
    const done = vi.fn();
    const cancel = trackReviewLinkOpen(done);
    cancel();
    vi.advanceTimersByTime(1000);
    expect(done).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("effect replay counts once, fresh opening counts again", () => {
    const done = vi.fn();
    function Opening() {
      useEffect(() => trackReviewLinkOpen(done), []);
      return null;
    }
    const first = render(
      <StrictMode>
        <Opening />
      </StrictMode>,
    );
    vi.advanceTimersByTime(0);
    expect(window.gtag).toHaveBeenCalledOnce();
    first.rerender(
      <StrictMode>
        <Opening />
      </StrictMode>,
    );
    vi.advanceTimersByTime(25);
    expect(window.gtag).toHaveBeenCalledOnce();
    first.unmount();
    render(
      <StrictMode>
        <Opening />
      </StrictMode>,
    );
    vi.advanceTimersByTime(0);
    expect(window.gtag).toHaveBeenCalledTimes(2);
  });
});
