import { Profiler } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReadingProgressBar } from "./ReadingProgressBar";

let frames: Map<number, FrameRequestCallback>;

function scrollTo(y: number, flush = true) {
  act(() => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: y });
    window.dispatchEvent(new Event("scroll"));
    if (flush) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    }
  });
}

function indicator() {
  return document.body.querySelector("[aria-hidden] > div");
}

beforeEach(() => {
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 2000,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    configurable: true,
    value: 1000,
  });
  frames = new Map();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("updates 50 scroll frames without React commits and preserves progress", () => {
  const onRender = vi.fn();
  render(
    <Profiler id="reading-progress" onRender={onRender}>
      <ReadingProgressBar />
    </Profiler>,
  );
  onRender.mockClear();
  for (let i = 1; i <= 50; i++) scrollTo(i * 10);
  expect(onRender).not.toHaveBeenCalled();
  expect(indicator()).toHaveStyle({ transform: "scaleX(0.5)" });
});

it("clamps overscroll and handles a page without scrollable content", () => {
  render(<ReadingProgressBar />);
  scrollTo(-30);
  expect(indicator()).toHaveStyle({ transform: "scaleX(0)" });
  scrollTo(3000);
  expect(indicator()).toHaveStyle({ transform: "scaleX(1)" });
  Object.defineProperty(document.documentElement, "scrollHeight", { value: 1000 });
  scrollTo(0);
  expect(indicator()).toHaveStyle({ transform: "scaleX(0)" });
});

it("restores initial scroll progress and recalculates it after viewport resize", () => {
  Object.defineProperty(window, "scrollY", { configurable: true, value: 500 });
  render(<ReadingProgressBar />);
  expect(indicator()).toHaveStyle({ transform: "scaleX(0.5)" });
  Object.defineProperty(document.documentElement, "clientHeight", { value: 500 });
  act(() => {
    window.dispatchEvent(new Event("resize"));
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  });
  expect(indicator()).toHaveStyle({ transform: `scaleX(${1 / 3})` });
});

it("coalesces scroll events into one frame and cancels pending work on unmount", () => {
  const { unmount } = render(<ReadingProgressBar />);
  scrollTo(10, false);
  scrollTo(20, false);
  expect(frames.size).toBe(1);
  unmount();
  expect(frames.size).toBe(0);
  scrollTo(30, false);
  expect(frames.size).toBe(0);
});
