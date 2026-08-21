import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoSlide } from "./VideoSlide";

afterEach(() => {
  delete (window as unknown as { YT?: unknown }).YT;
});

describe("Product gallery video facade", () => {
  it("does not mount a provider iframe until the customer presses Play", () => {
    const onPlay = vi.fn();
    render(
      <VideoSlide
        video={{
          id: "tik-tok-1",
          url: "https://www.tiktok.com/@bigbike/video/7412345678901234567",
          title: "TikTok product video",
        }}
        onPlay={onPlay}
      />,
    );

    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play TikTok product video" }));

    expect(document.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.tiktok.com/embed/v2/7412345678901234567",
    );
    // TikTok has no dependable playback event, so the carousel's iframe-focus
    // fallback decides when to pause/resume instead of guessing on facade click.
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("starts YouTube only after Play and uses the privacy-enhanced embed host", async () => {
    const onPlay = vi.fn();
    const YT = {
      PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 },
      Player: class {
        constructor(host: HTMLElement, options: { host?: string; videoId?: string; events?: { onStateChange?: (event: { data: number }) => void } }) {
          const frame = document.createElement("iframe");
          frame.src = `${options.host}/embed/${options.videoId}`;
          host.appendChild(frame);
          options.events?.onStateChange?.({ data: 1 });
        }

        pauseVideo() {}
        destroy() {}
        getPlayerState() { return 1; }
      },
    };
    (window as unknown as { YT: typeof YT }).YT = YT;

    render(
      <VideoSlide
        video={{
          id: "youtube-1",
          url: "https://www.youtube.com/watch?v=abcdefghijk",
          title: "YouTube product video",
        }}
        onPlay={onPlay}
      />,
    );

    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play YouTube product video" }));

    await waitFor(() => {
      expect(document.querySelector("iframe")).toHaveAttribute(
        "src",
        "https://www.youtube-nocookie.com/embed/abcdefghijk",
      );
    });
    expect(onPlay).toHaveBeenCalled();
  });
});
