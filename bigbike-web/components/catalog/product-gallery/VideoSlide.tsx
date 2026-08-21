"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import type { VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import {
  facebookEmbedUrl,
  getTikTokId,
  getYouTubeId,
  isFacebookVideoUrl,
  tiktokEmbedUrl,
  videoThumbUrl,
} from "./media";

type YTPlayer = { destroy?: () => void; pauseVideo?: () => void; getPlayerState?: () => number };
type YTPlayerOptions = {
  width?: string | number;
  height?: string | number;
  videoId?: string;
  host?: string;
  playerVars?: Record<string, string | number>;
  events?: { onStateChange?: (e: { data: number }) => void };
};
type YTNamespace = {
  Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};
type YTWindow = { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const windowWithYt = window as unknown as YTWindow;
  if (windowWithYt.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const previous = windowWithYt.onYouTubeIframeAPIReady;
    windowWithYt.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

type VideoSlideProps = {
  video: VideoAsset;
  active?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
};

/**
 * Gallery video facade: the initial PDP only contains a poster and a Play button.
 * The actual player (and the YouTube API) is mounted after the customer chooses
 * to play it. This keeps provider scripts/iframes out of the initial page load.
 */
export function VideoSlide({ video, active, onPlay, onPause, onEnded }: VideoSlideProps) {
  const url = video.url ?? "";
  const ytId = getYouTubeId(url);
  const tiktokId = ytId ? null : getTikTokId(url);
  const isFacebook = !ytId && !tiktokId && isFacebookVideoUrl(url);
  const resolvedUrl = resolveMediaUrl(url) ?? url;
  const posterUrl = videoThumbUrl(video);
  const title = video.title?.trim() || "Video";
  const [activated, setActivated] = useState(false);
  const [ytFallback, setYtFallback] = useState(false);
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const ytFrameId = `yt-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  function activate() {
    setActivated(true);
    // YouTube and internal video begin from this same customer gesture. TikTok
    // and Facebook report playback unreliably, so ProductGallery keeps its
    // focus-based fallback instead of assuming that their embed is playing.
    if (ytId || (!tiktokId && !isFacebook)) onPlay?.();
  }

  useEffect(() => {
    if (!activated || !ytId) return;
    let cancelled = false;
    let player: YTPlayer | null = null;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) setYtFallback(true);
    }, 8000);

    loadYouTubeApi().then(() => {
      if (cancelled) return;
      const yt = (window as unknown as YTWindow).YT;
      if (!yt?.Player || !ytHostRef.current) {
        setYtFallback(true);
        return;
      }
      window.clearTimeout(fallbackTimer);
      player = new yt.Player(ytHostRef.current, {
        width: "100%",
        height: "100%",
        videoId: ytId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onStateChange: (event) => {
            if (event.data === yt.PlayerState.PLAYING) onPlay?.();
            else if (event.data === yt.PlayerState.PAUSED) onPause?.();
            else if (event.data === yt.PlayerState.ENDED) onEnded?.();
          },
        },
      });
      ytPlayerRef.current = player;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      try {
        player?.destroy?.();
      } catch {
        // The iframe may already have been removed while changing slides.
      }
      ytPlayerRef.current = null;
    };
  }, [activated, ytId, onEnded, onPause, onPlay]);

  useEffect(() => {
    if (!activated || !ytId || active === false) return;
    let previousState = -1;
    const intervalId = window.setInterval(() => {
      const state = ytPlayerRef.current?.getPlayerState?.();
      if (typeof state !== "number" || state === previousState) return;
      previousState = state;
      if (state === 1 || state === 3) onPlay?.();
      else if (state === 2) onPause?.();
      else if (state === 0) onEnded?.();
    }, 300);
    return () => window.clearInterval(intervalId);
  }, [activated, active, ytId, onEnded, onPause, onPlay]);

  useEffect(() => {
    if (active !== false) return;
    try {
      ytPlayerRef.current?.pauseVideo?.();
    } catch {
      // The player may not be ready yet.
    }
    nativeVideoRef.current?.pause();
  }, [active]);

  if (!activated) {
    return (
      <button
        type="button"
        className="relative block h-full w-full cursor-pointer overflow-hidden bg-black text-white focus-visible:[outline:var(--bb-focus-outline)] focus-visible:[outline-offset:-4px]"
        onClick={activate}
        aria-label={`Play ${title}`}
        data-product-gallery-video-play
      >
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            unoptimized
            className="object-cover"
            priority
          />
        ) : (
          <span className="block h-full w-full bg-black" aria-hidden="true" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25" aria-hidden="true">
          <svg viewBox="0 0 48 48" className="h-14 w-14 fill-white drop-shadow" focusable="false">
            <path d="M15 10.6v26.8L37 24 15 10.6Z" />
          </svg>
        </span>
      </button>
    );
  }

  if (ytId && !ytFallback) {
    return (
      <div className="relative block h-full w-full bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0" data-product-gallery-video-player>
        <div ref={ytHostRef} id={ytFrameId} />
      </div>
    );
  }

  if (ytId) {
    return (
      <iframe
        className="block h-full w-full border-none bg-black"
        src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&enablejsapi=1&playsinline=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        data-product-gallery-video-player
      />
    );
  }

  if (tiktokId) {
    return (
      <iframe
        className="block h-full w-full border-none bg-black"
        src={tiktokEmbedUrl(tiktokId)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        data-product-gallery-video-player
      />
    );
  }

  if (isFacebook) {
    return (
      <iframe
        className="block h-full w-full border-none bg-black"
        src={facebookEmbedUrl(url)}
        title={title}
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        data-product-gallery-video-player
      />
    );
  }

  return (
    <video
      ref={nativeVideoRef}
      className="block h-full w-full bg-black object-contain"
      src={resolvedUrl}
      controls
      autoPlay
      playsInline
      poster={video.thumbnail?.url}
      onPlay={onPlay}
      onPause={onPause}
      onEnded={onEnded}
      data-product-gallery-video-player
    />
  );
}
