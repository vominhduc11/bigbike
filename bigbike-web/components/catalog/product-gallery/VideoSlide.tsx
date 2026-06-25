import type { VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { facebookEmbedUrl, getTikTokId, getYouTubeId, isFacebookVideoUrl, tiktokEmbedUrl } from "./media";

/** Slide video trong carousel ảnh chính: YouTube/TikTok/Facebook → iframe embed; video thư viện → thẻ <video controls>. */
export function VideoSlide({ video }: { video: VideoAsset }) {
  const url = video.url ?? "";
  const ytId = getYouTubeId(url);
  const tiktokId = ytId ? null : getTikTokId(url);
  const isFacebook = !ytId && !tiktokId && isFacebookVideoUrl(url);
  const resolved = resolveMediaUrl(url) ?? url;
  const title = video.title ?? "Video";

  if (ytId) {
    return (
      <iframe
        className="block w-full h-full border-none bg-black"
        src={`https://www.youtube.com/embed/${ytId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (tiktokId) {
    return (
      <iframe
        className="block w-full h-full border-none bg-black"
        src={tiktokEmbedUrl(tiktokId)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  if (isFacebook) {
    return (
      <iframe
        className="block w-full h-full border-none bg-black"
        src={facebookEmbedUrl(url)}
        title={title}
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  return (
    <video
      className="block w-full h-full object-contain bg-black"
      src={resolved}
      controls
      playsInline
      poster={video.thumbnail?.url}
    />
  );
}
