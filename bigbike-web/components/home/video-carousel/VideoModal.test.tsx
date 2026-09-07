import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeVideo } from "@/lib/contracts/public";
import type { YouTubePlayerOptions } from "@/lib/youtube-player";
import { VideoModal } from "./VideoModal";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { current: number; total: number }) =>
    values ? `Video ${values.current} of ${values.total}` : key,
}));

const loadApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/youtube-player", () => ({ loadYouTubeApi: loadApi }));

beforeEach(() => {
  vi.clearAllMocks();
  loadApi.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => vi.useRealTimers());

function homeVideo(videoUrl: string): HomeVideo {
  return {
    id: "legacy-video",
    sortOrder: 0,
    title: "Legacy video",
    videoUrl,
    youtubeId: null,
    embedUrl: null,
    autoThumbnailUrl: null,
    thumbnail: null,
  };
}

const callbacks = {
  onClose: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
};

describe("VideoModal legacy read compatibility", () => {
  it.each([
    [
      "TikTok",
      "https://www.tiktok.com/@bigbike/video/7412345678901234567",
      "https://www.tiktok.com/embed/v2/7412345678901234567",
    ],
    [
      "Facebook",
      "https://www.facebook.com/bigbike/videos/123456789",
      "https://www.facebook.com/plugins/video.php",
    ],
  ])("vẫn render iframe %s cũ", (_provider, videoUrl, expectedSrc) => {
    render(<VideoModal videos={[homeVideo(videoUrl)]} activeIndex={0} {...callbacks} />);

    const frame = screen.getByTitle("Legacy video");
    expect(frame).toHaveAttribute("src", expect.stringContaining(expectedSrc));
  });

  it("dùng video fallback cho URL không nhận diện mà không làm vỡ modal", () => {
    render(
      <VideoModal
        videos={[homeVideo("https://cdn.example.com/legacy-source")]}
        activeIndex={0}
        {...callbacks}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Legacy video" })).toBeInTheDocument();
    expect(document.body.querySelector("video")).toHaveAttribute(
      "src",
      "https://cdn.example.com/legacy-source#t=0.001",
    );
  });

  it("hiển thị mô tả thật ngay dưới trình phát khi video sản phẩm có mô tả", () => {
    render(
      <VideoModal
        videos={[
          {
            ...homeVideo("https://cdn.example.com/product.mp4"),
            description: "Mô tả khách đang xem.",
          },
        ]}
        activeIndex={0}
        {...callbacks}
      />,
    );

    expect(screen.getByText("Mô tả khách đang xem.")).toBeInTheDocument();
  });
});

describe("Video viewer interaction and recovery", () => {
  it("restores the explicit trigger after closing even when a touch click did not focus it", async () => {
    function TouchHarness() {
      const [open, setOpen] = useState(false);
      const trigger = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <button
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setOpen(true);
            }}
          >
            Touch video
          </button>
          {open && (
            <VideoModal
              videos={[homeVideo("")]}
              activeIndex={0}
              {...callbacks}
              onClose={() => setOpen(false)}
              onAfterClose={() => trigger.current?.focus({ preventScroll: true })}
            />
          )}
        </>
      );
    }
    render(<TouchHarness />);
    const trigger = screen.getByRole("button", { name: "Touch video" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "videoClose" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps the complete long title and description available without duplicating the title", () => {
    const title = "Hướng dẫn tháo lắp và vệ sinh lót mũ bảo hiểm dành cho những chuyến đi dài";
    const description = "Hướng dẫn sử dụng sản phẩm.\n".repeat(40);
    render(
      <VideoModal
        videos={[{ ...homeVideo("/media/product.mp4"), title, description }]}
        activeIndex={0}
        {...callbacks}
      />,
    );
    expect(screen.getAllByText(title)).toHaveLength(1);
    expect(document.querySelector("[data-video-description]")?.textContent).toBe(description.trim());
  });

  it("does not render a broken dialog for empty data or an invalid index", () => {
    const { rerender } = render(<VideoModal videos={[]} activeIndex={0} {...callbacks} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<VideoModal videos={[homeVideo("")]} activeIndex={3} {...callbacks} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a designed missing-source state and hides single-video navigation", () => {
    render(<VideoModal videos={[homeVideo("")]} activeIndex={0} {...callbacks} />);
    expect(screen.getByText("error")).toBeVisible();
    expect(screen.queryByRole("button", { name: "retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "videoNext" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("retains an accessible title when no title was supplied", () => {
    render(
      <VideoModal videos={[{ ...homeVideo(""), title: "" }]} activeIndex={0} {...callbacks} />,
    );
    expect(screen.getByRole("dialog", { name: "watchVideoFallback" })).toBeInTheDocument();
  });

  it("loads a native video, reports failures and mounts a fresh player on retry", () => {
    render(
      <VideoModal videos={[homeVideo("/media/product.mp4")]} activeIndex={0} {...callbacks} />,
    );
    const player = document.querySelector("video")!;
    expect(screen.getByText("loading")).toBeVisible();
    fireEvent.loadedData(player);
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
    fireEvent.error(player);
    expect(screen.getByText("error")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(document.querySelector("video")).not.toBe(player);
    expect(screen.getByText("loading")).toBeVisible();
  });

  it("offers retry after a slow load and still accepts a late successful load", () => {
    vi.useFakeTimers();
    render(
      <VideoModal videos={[homeVideo("/media/product.mp4")]} activeIndex={0} {...callbacks} />,
    );
    act(() => vi.advanceTimersByTime(12000));
    expect(screen.getByText("slow")).toBeVisible();
    expect(screen.getByRole("button", { name: "retry" })).toBeVisible();
    fireEvent.loadedData(document.querySelector("video")!);
    expect(screen.queryByText("slow")).not.toBeInTheDocument();
  });

  it("keeps source links safe and preserves a legacy provider escape route", () => {
    const { rerender } = render(
      <VideoModal
        videos={[homeVideo("https://www.facebook.com/bigbike/videos/123456789")]}
        activeIndex={0}
        {...callbacks}
      />,
    );
    expect(screen.getByRole("link", { name: "openSource" })).toHaveAttribute(
      "href",
      "https://www.facebook.com/bigbike/videos/123456789",
    );
    rerender(
      <VideoModal videos={[homeVideo("javascript:alert(1)")]} activeIndex={0} {...callbacks} />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("updates position and dispatches navigation without stealing native player arrows", () => {
    const videos = [homeVideo("/media/one.mp4"), { ...homeVideo("/media/two.mp4"), id: "two" }];
    const { rerender } = render(<VideoModal videos={videos} activeIndex={0} {...callbacks} />);
    expect(screen.getByLabelText("Video 1 of 2")).toHaveTextContent("1 / 2");
    fireEvent.keyDown(document.querySelector("video")!, { key: "ArrowRight" });
    expect(callbacks.onNext).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button", { name: "videoClose" }), { key: "ArrowRight" });
    expect(callbacks.onNext).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "videoPrev" }));
    expect(callbacks.onPrev).toHaveBeenCalledOnce();
    rerender(<VideoModal videos={videos} activeIndex={1} {...callbacks} />);
    expect(screen.getByLabelText("Video 2 of 2")).toHaveTextContent("2 / 2");
  });

  it("closes with Escape, returns focus and restores the prior scroll setting", async () => {
    document.body.style.overflow = "auto";
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open viewer</button>
          {open && (
            <VideoModal
              videos={[homeVideo("")]}
              activeIndex={0}
              {...callbacks}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open viewer" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "videoClose" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });
});

describe("YouTube readiness and cleanup", () => {
  function apiFixture() {
    const events: NonNullable<YouTubePlayerOptions["events"]>[] = [];
    const destroy = vi.fn();
    loadApi.mockResolvedValue({
      Player: class {
        constructor(_frame: HTMLElement, options: YouTubePlayerOptions) {
          events.push(options.events!);
        }
        destroy = destroy;
      },
    });
    return { events, destroy };
  }
  const youtubeVideo = { ...homeVideo("https://youtu.be/abcdefghijk"), youtubeId: "abcdefghijk" };

  it("waits for real readiness, uses inline playback and leaves provider UI usable if autoplay is blocked", async () => {
    const { events } = apiFixture();
    render(<VideoModal videos={[youtubeVideo]} activeIndex={0} {...callbacks} />);
    await waitFor(() => expect(events).toHaveLength(1));
    const frame = document.querySelector("iframe")!;
    const url = new URL(frame.src);
    expect(url.searchParams.get("playsinline")).toBe("1");
    expect(url.searchParams.get("origin")).toBe(window.location.origin);
    fireEvent.load(frame);
    expect(screen.getByText("loading")).toBeVisible();
    act(() => events[0].onAutoplayBlocked?.());
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "openSource" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
  });

  it("handles a provider error, destroys the old player and ignores its late events after retry", async () => {
    const { events, destroy } = apiFixture();
    render(<VideoModal videos={[youtubeVideo]} activeIndex={0} {...callbacks} />);
    await waitFor(() => expect(events).toHaveLength(1));
    act(() => events[0].onError?.({ data: 150 }));
    expect(screen.getByText("error")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => expect(events).toHaveLength(2));
    expect(destroy).toHaveBeenCalledOnce();
    act(() => events[0].onReady?.());
    expect(screen.getByText("loading")).toBeVisible();
    act(() => events[1].onReady?.());
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("falls back to the ordinary embed when the player API cannot load", async () => {
    loadApi.mockRejectedValue(new Error("offline"));
    render(<VideoModal videos={[youtubeVideo]} activeIndex={0} {...callbacks} />);
    await act(async () => {});
    fireEvent.load(document.querySelector("iframe")!);
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeInTheDocument();
  });

  it("does not create a player if the API resolves after the viewer was closed", async () => {
    let resolveApi!: (value: unknown) => void;
    loadApi.mockReturnValue(
      new Promise((resolve) => {
        resolveApi = resolve;
      }),
    );
    const Player = vi.fn();
    const { unmount } = render(
      <VideoModal videos={[youtubeVideo]} activeIndex={0} {...callbacks} />,
    );
    unmount();
    await act(async () => resolveApi({ Player }));
    expect(Player).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
  });
});
