import type { VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { getTikTokId, getYouTubeId, isFacebookVideoUrl, videoThumbUrl } from "./media";

// Hiển thị thumbnail cho video trong strip:
// 1. Nếu có ảnh thumbnail explicit (hoặc CDN YouTube) → <div> nền ảnh bg-cover.
// 2. TikTok/Facebook không có ảnh CDN công khai → ô nền (admin nên đặt ảnh đại diện).
// 3. Nếu video thư viện không có thumbnail → <video preload="metadata"> để
//    browser tự render frame đầu tiên (trick #t=0.001 đảm bảo decode trước seek).
//
// Ảnh đại diện vẽ bằng background-image trên <div> + bg-cover/bg-center (KHÔNG dùng
// <img object-cover>): ô vuông luôn được LẤP ĐẦY và CẮT phần thừa cho bất kỳ tỉ lệ
// ảnh nào. Lý do phải dùng <div> thay <img>: theme WP có luật toàn cục
// `body img{height:auto!important}` ép mọi <img> về height:auto, làm object-cover vô
// hiệu — ảnh ngang 16:9 của YouTube chỉ cao ~56% ô và hở dải đen dưới đáy. <div> nền
// ảnh không bị luật này đụng tới.
export function VideoThumbPreview({ video }: { video: VideoAsset }) {
  const thumb = videoThumbUrl(video);
  if (thumb) {
    return (
      <div
        role="img"
        aria-label={video.title ?? "Video"}
        className="w-full h-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${thumb.replaceAll('"', "%22")}")` }}
      />
    );
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
