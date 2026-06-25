import type { VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { getTikTokId, getYouTubeId, isFacebookVideoUrl, videoThumbUrl } from "./media";

// Hiển thị thumbnail cho video trong strip:
// 1. Nếu có ảnh thumbnail explicit → <img>
// 2. Nếu YouTube → ảnh CDN YouTube
// 3. TikTok/Facebook không có ảnh CDN công khai → ô nền (admin nên đặt ảnh đại diện).
// 4. Nếu video thư viện không có thumbnail → <video preload="metadata"> để
//    browser tự render frame đầu tiên (trick #t=0.001 đảm bảo decode trước seek).
export function VideoThumbPreview({ video }: { video: VideoAsset }) {
  const thumb = videoThumbUrl(video);
  if (thumb) {
    return <img src={thumb} alt={video.title ?? "Video"} className="w-full h-full object-cover" />;
  }
  const url = video.url ?? "";
  const ytId = getYouTubeId(url);
  const tiktokId = ytId ? null : getTikTokId(url);
  const isFacebook = !ytId && !tiktokId && isFacebookVideoUrl(url);
  if (!ytId && !tiktokId && !isFacebook) {
    const resolved = resolveMediaUrl(url) ?? url;
    const src = resolved ? `${resolved}#t=0.001` : "";
    return (
      <video
        src={src}
        className="w-full h-full object-cover"
        muted
        preload="metadata"
        playsInline
        tabIndex={-1}
      />
    );
  }
  return <div className="w-full h-full bg-neutral-800" />;
}
