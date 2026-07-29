import { describe, expect, it } from "vitest";
import type { GalleryMedia } from "@/lib/contracts/public";
import {
  buildGalleryItems,
  facebookEmbedUrl,
  getTikTokId,
  isFacebookVideoUrl,
  isSupportedVideo,
  tiktokEmbedUrl,
} from "./media";

// Dải gallery giống ảnh chụp admin: 3 ảnh rồi 1 video YouTube ở cuối.
const img = (id: string): GalleryMedia => ({
  mediaType: "image",
  image: { id, url: `/media/${id}.jpg`, alt: id, width: 1200, height: 1200, mimeType: "image/jpeg" },
}) as unknown as GalleryMedia;

const ytVideo: GalleryMedia = {
  mediaType: "video",
  provider: "youtube",
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  image: null,
} as unknown as GalleryMedia;

describe("buildGalleryItems giữ nguyên thứ tự admin", () => {
  it("video sắp cuối thì hiển thị cuối — KHÔNG bị đẩy lên đầu", () => {
    const items = buildGalleryItems([img("a"), img("b"), img("c"), ytVideo]);
    expect(items.map((i) => i.kind)).toEqual(["image", "image", "image", "video"]);
  });

  it("video xen giữa các ảnh thì giữ đúng vị trí giữa", () => {
    const items = buildGalleryItems([img("a"), ytVideo, img("b")]);
    expect(items.map((i) => i.kind)).toEqual(["image", "video", "image"]);
  });

  it("khử ảnh trùng id/url nhưng giữ thứ tự", () => {
    const items = buildGalleryItems([img("a"), img("a"), img("b")]);
    expect(items.map((i) => i.kind)).toEqual(["image", "image"]);
  });
});

describe("legacy video read compatibility", () => {
  it("nhận diện và dựng iframe TikTok/Facebook cũ", () => {
    const tiktokUrl = "https://www.tiktok.com/@bigbike/video/7412345678901234567";
    const facebookUrl = "https://www.facebook.com/bigbike/videos/123456789";

    expect(getTikTokId(tiktokUrl)).toBe("7412345678901234567");
    expect(tiktokEmbedUrl("7412345678901234567")).toBe(
      "https://www.tiktok.com/embed/v2/7412345678901234567",
    );
    expect(isFacebookVideoUrl(facebookUrl)).toBe(true);
    expect(facebookEmbedUrl(facebookUrl)).toContain("https://www.facebook.com/plugins/video.php");
    expect(isSupportedVideo({ provider: "tiktok", url: tiktokUrl })).toBe(true);
    expect(isSupportedVideo({ provider: "facebook", url: facebookUrl })).toBe(true);
  });

  it("bỏ qua nguồn lạ trong gallery nhưng vẫn giữ các media hợp lệ", () => {
    const unknown = {
      mediaType: "video",
      provider: "unknown",
      videoUrl: "https://example.com/watch/123",
      image: null,
    } as unknown as GalleryMedia;

    const items = buildGalleryItems([img("a"), unknown, ytVideo]);
    expect(items.map((item) => item.kind)).toEqual(["image", "video"]);
  });
});
