"use client";

import { useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import { safeText } from "@/lib/utils/format";
import type { VideoAsset } from "@/lib/contracts/public";

/** Extract a YouTube video id from watch / youtu.be / embed / shorts URLs. */
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

function isUploadedVideoUrl(url: string): boolean {
  if (!url) return false;
  const path = url.split(/[?#]/, 1)[0];
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(path);
}

/**
 * Featured product video shown below the hero gallery. Renders a poster with a
 * play overlay and only loads the heavy embed/player once the customer clicks —
 * keeps the PDP lightweight on first paint.
 */
export function ProductHeroVideo({
  video,
  productName,
}: {
  video: VideoAsset;
  productName: string;
}) {
  const [playing, setPlaying] = useState(false);
  const url = video.url ?? "";
  const ytId = getYouTubeId(url);
  const isUpload = !ytId && (video.provider === "upload" || isUploadedVideoUrl(url));
  const title = safeText(video.title, `Video ${productName}`);

  if (!ytId && !isUpload) return null;

  if (playing && ytId) {
    return (
      <div className="relative aspect-video overflow-hidden border border-border bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  if (playing && isUpload) {
    return (
      <div className="relative aspect-video overflow-hidden border border-border bg-black">
        <video
          src={url}
          controls
          autoPlay
          playsInline
          poster={video.thumbnail?.url}
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Phát ${title}`}
      className="group relative block aspect-video w-full overflow-hidden border border-border bg-[#141414]"
    >
      <MediaImage
        image={video.thumbnail ?? undefined}
        altFallback={title}
        width={960}
        height={540}
        className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/90 text-white transition-transform group-hover:scale-110">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-3 py-2 text-left text-xs text-white">
        {title}
      </span>
    </button>
  );
}
