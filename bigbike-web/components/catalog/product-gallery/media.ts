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

// TikTok: chỉ link đầy đủ (vt./vm. rút gọn không có id số → bỏ qua).
export function getTikTokId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:www\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/|video\/|v\/|embed\/v2\/|embed\/)(\d{6,30})/,
  );
  return match ? match[1] : null;
}

export function tiktokEmbedUrl(id: string): string {
  return `https://www.tiktok.com/embed/v2/${id}`;
}

// Facebook: nhúng cả link gốc (fb.watch rút gọn không hỗ trợ). Chỉ video công khai mới render.
export function isFacebookVideoUrl(url: string): boolean {
  if (!url) return false;
  return /^https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?:[^?#]*\/videos\/|reel\/|watch\/?(?:\?|$)|[^?#]*video\.php)/i.test(url);
}

export function facebookEmbedUrl(url: string): string {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
}

export function isSupportedVideo(video: VideoAsset): boolean {
  const url = video.url ?? "";
  if (!url) return false;
  if (getYouTubeId(url)) return true;
  if (getTikTokId(url)) return true;
  if (isFacebookVideoUrl(url)) return true;
  const path = url.split(/[?#]/, 1)[0];
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(path);
}

export function videoThumbUrl(video: VideoAsset): string | null {
  const explicit = resolveMediaUrl(video.thumbnail?.url?.trim());
  if (explicit) return explicit;
  const ytId = getYouTubeId(video.url ?? "");
  // `mqdefault.jpg` giữ đúng tỉ lệ 16:9 gốc của video — KHÔNG có dải đen letterbox
  // như `hqdefault.jpg` (vốn pad về khung 4:3). Ô thumbnail vuông vẽ ảnh này bằng
  // <div> nền bg-cover (xem VideoThumbPreview) nên ảnh 16:9 được crop cho lấp đầy ô,
  // không còn khoảng đen.
  return ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
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
        provider: m.provider ?? m.videoProvider ?? undefined,
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

// Dựng danh sách hiển thị (ảnh + video) GIỮ NGUYÊN thứ tự admin sắp trong gallery —
// không còn dồn video lên đầu. Ảnh trùng (theo id hoặc url, do import WP lặp) bị khử;
// video không hỗ trợ (link không nhận diện được) bị bỏ.
export function buildGalleryItems(items: GalleryMedia[] | undefined): GalleryItem[] {
  const out: GalleryItem[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  for (const m of items ?? []) {
    if (m?.mediaType === "video") {
      const v: VideoAsset = {
        url: m.videoUrl ?? undefined,
        provider: m.provider ?? m.videoProvider ?? undefined,
        thumbnail: m.image ?? null,
        title: m.image?.alt ?? undefined,
      };
      if (isSupportedVideo(v)) out.push({ kind: "video", asset: v });
    } else if (m?.image) {
      const img = m.image;
      if ((img.id && seenIds.has(img.id)) || (img.url && seenUrls.has(img.url))) continue;
      if (img.id) seenIds.add(img.id);
      if (img.url) seenUrls.add(img.url);
      out.push({ kind: "image", asset: img });
    }
  }
  return out;
}
