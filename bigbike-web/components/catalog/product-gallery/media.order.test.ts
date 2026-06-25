import { describe, expect, it } from "vitest";
import type { GalleryMedia } from "@/lib/contracts/public";
import { buildGalleryItems } from "./media";

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
