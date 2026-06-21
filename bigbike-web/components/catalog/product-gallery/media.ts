import type { GalleryMedia, ImageAsset, VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";

// Hover-to-zoom: di chuột vào ảnh chính hiện kính lúp + khung phóng to bên phải.
// Chỉ bật trên thiết bị có chuột thật (hover + pointer mịn) và màn đủ rộng cho
// khung phóng to nằm bên phải (>=1181px) — đúng như behavior cũ trước migration.
export const ZOOM_FACTOR = 2.5;
export const LENS_SIZE_PCT = 100 / ZOOM_FACTOR;

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

// --- Video helpers ---

export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

export function isSupportedVideo(video: VideoAsset): boolean {
  const url = video.url ?? "";
  if (!url) return false;
  if (getYouTubeId(url)) return true;
  const path = url.split(/[?#]/, 1)[0];
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(path);
}

export function videoThumbUrl(video: VideoAsset): string | null {
  const explicit = resolveMediaUrl(video.thumbnail?.url?.trim());
  if (explicit) return explicit;
  const ytId = getYouTubeId(video.url ?? "");
  return ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
}

// V248: dải media (gallery) giờ chứa cả ảnh lẫn video. Tách 1 danh sách GalleryMedia
// thành { images, videos } để phần render bên dưới (vốn dùng ImageAsset[]/VideoAsset[]) chạy nguyên.
export function splitGalleryMedia(items: GalleryMedia[] | undefined): { images: ImageAsset[]; videos: VideoAsset[] } {
  const images: ImageAsset[] = [];
  const videos: VideoAsset[] = [];
  for (const m of items ?? []) {
    if (m?.mediaType === "video") {
      const v: VideoAsset = {
        url: m.videoUrl ?? undefined,
        provider: m.provider ?? undefined,
        thumbnail: m.image ?? null,
        title: m.image?.alt ?? undefined,
      };
      if (isSupportedVideo(v)) videos.push(v);
    } else if (m?.image) {
      images.push(m.image);
    }
  }
  return { images, videos };
}

// --- Gallery item union type ---

export type ImageItem = { kind: "image"; asset: ImageAsset };
export type VideoItem = { kind: "video"; asset: VideoAsset };
export type GalleryItem = ImageItem | VideoItem;
