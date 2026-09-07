import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const host = window as Window & { YT?: unknown; onYouTubeIframeAPIReady?: () => void };
beforeEach(() => {
  vi.resetModules();
  delete host.YT;
  delete host.onYouTubeIframeAPIReady;
});
afterEach(() => {
  document
    .querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')
    .forEach((script) => script.remove());
  delete host.YT;
  delete host.onYouTubeIframeAPIReady;
  vi.useRealTimers();
});

describe("Shared YouTube API loader", () => {
  it("reuses one script and preserves the pre-existing ready callback", async () => {
    const { loadYouTubeApi } = await import("./youtube-player");
    const previous = vi.fn();
    host.onYouTubeIframeAPIReady = previous;
    const first = loadYouTubeApi();
    expect(loadYouTubeApi()).toBe(first);
    expect(
      document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]'),
    ).toHaveLength(1);
    host.YT = { Player: class {} };
    host.onYouTubeIframeAPIReady?.();
    expect(await first).toBe(host.YT);
    expect(previous).toHaveBeenCalledOnce();
    expect(host.onYouTubeIframeAPIReady).toBe(previous);
    expect(await loadYouTubeApi()).toBe(host.YT);
  });

  it("permits a fresh attempt after a network error", async () => {
    const { loadYouTubeApi } = await import("./youtube-player");
    const failed = expect(loadYouTubeApi()).rejects.toThrow("unavailable");
    document
      .querySelector('script[src="https://www.youtube.com/iframe_api"]')!
      .dispatchEvent(new Event("error"));
    await failed;
    const retried = loadYouTubeApi();
    host.YT = { Player: class {} };
    host.onYouTubeIframeAPIReady?.();
    expect(await retried).toBe(host.YT);
  });

  it("times out and clears the failed script so retry is possible", async () => {
    vi.useFakeTimers();
    const { loadYouTubeApi } = await import("./youtube-player");
    const pending = expect(loadYouTubeApi()).rejects.toThrow("unavailable");
    await vi.advanceTimersByTimeAsync(12000);
    await pending;
    expect(document.querySelector('script[src="https://www.youtube.com/iframe_api"]')).toBeNull();
  });
});
