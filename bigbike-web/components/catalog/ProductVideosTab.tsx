"use client";

import { useMemo, useState } from "react";
import type { VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

// iframe/video share one look in both the single + grid-main contexts.
const VIDEO_FRAME = "block w-full aspect-video border-none bg-black";

type ProductVideosTabProps = {
  videos: VideoAsset[];
};

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

function isSupportedVideo(video: VideoAsset): boolean {
  const url = video.url ?? "";
  if (!url) return false;
  if (getYouTubeId(url)) return true;
  const path = url.split(/[?#]/, 1)[0];
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(path);
}

function VideoFrame({ video }: { video: VideoAsset }) {
  const title = safeText(video.title, "Video");
  const url = video.url ?? "";
  const ytId = getYouTubeId(url);
  const resolved = resolveMediaUrl(url) ?? url;

  if (ytId) {
    return (
      <iframe
        className={VIDEO_FRAME}
        src={`https://www.youtube.com/embed/${ytId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return <video className={VIDEO_FRAME} src={resolved} controls playsInline poster={video.thumbnail?.url} />;
}

function videoThumbUrl(video: VideoAsset): string | null {
  const explicit = resolveMediaUrl(video.thumbnail?.url?.trim());
  if (explicit) return explicit;
  const ytId = getYouTubeId(video.url ?? "");
  return ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
}

export function ProductVideosTab({ videos }: ProductVideosTabProps) {
  const validVideos = useMemo(() => videos.filter(isSupportedVideo), [videos]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (validVideos.length === 0) {
    return (
      <div>
        <div>
          <p className="mb-3">Chưa có video nào</p>
        </div>
      </div>
    );
  }

  const selected = validVideos[selectedIndex] ?? validVideos[0];

  if (validVideos.length === 1) {
    return (
      <div>
        <VideoFrame video={selected} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[2fr_1fr] max-[1024px]:grid-cols-1 gap-[30px]">
      <div>
        <VideoFrame video={selected} />
      </div>
      <div className="flex flex-col gap-[15px]">
        {validVideos.map((video, index) => {
          const title = safeText(video.title, "Video");
          const thumb = videoThumbUrl(video);
          return (
            <button
              key={video.id ?? video.url ?? index}
              type="button"
              className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 items-center border-none bg-transparent p-0 text-left cursor-pointer"
              onClick={() => setSelectedIndex(index)}
            >
              <span
                className="block w-[110px] aspect-video bg-black bg-center bg-cover bg-no-repeat"
                style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "font-semibold !leading-[1.35]",
                  index === selectedIndex ? "text-brand" : "text-black",
                )}
              >
                {title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
