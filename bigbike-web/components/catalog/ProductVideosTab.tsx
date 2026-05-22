"use client";

import { useMemo, useState } from "react";
import type { VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";

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
        src={`https://www.youtube.com/embed/${ytId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return <video src={resolved} controls playsInline poster={video.thumbnail?.url} />;
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
    return <p>Chưa có video nào</p>;
  }

  const selected = validVideos[selectedIndex] ?? validVideos[0];

  if (validVideos.length === 1) {
    return (
      <div className="bb-wp-video-single">
        <VideoFrame video={selected} />
      </div>
    );
  }

  return (
    <div className="bb-wp-video-grid">
      <div className="bb-wp-video-main">
        <VideoFrame video={selected} />
      </div>
      <div className="bb-wp-video-list">
        {validVideos.map((video, index) => {
          const title = safeText(video.title, "Video");
          const thumb = videoThumbUrl(video);
          return (
            <button
              key={video.id ?? video.url ?? index}
              type="button"
              className={`video-slide--items js-video-other${index === selectedIndex ? " is-active" : ""}`}
              onClick={() => setSelectedIndex(index)}
            >
              <span
                className="video-slide--thumb"
                style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                aria-hidden="true"
              />
              <span className="video-slide--title">{title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
