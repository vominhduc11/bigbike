import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HomeVideo } from "@/lib/contracts/public";
import { VideoModal } from "./VideoModal";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

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
    render(
      <VideoModal
        videos={[homeVideo(videoUrl)]}
        activeIndex={0}
        {...callbacks}
      />,
    );

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
});
