"use client";

import { useEffect, useId, useRef } from "react";
import type { VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { facebookEmbedUrl, getTikTokId, getYouTubeId, isFacebookVideoUrl, tiktokEmbedUrl } from "./media";

// Nạp YouTube IFrame API một lần cho cả trang. Dùng để biết khi khách BẤM PLAY và
// khi video XEM HẾT (YouTube nhúng iframe chéo miền nên không có sự kiện DOM trực
// tiếp). Không hề tự phát — chỉ lắng nghe trạng thái người dùng thao tác.
type YTPlayer = { destroy?: () => void; pauseVideo?: () => void };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: { events?: { onStateChange?: (e: { data: number }) => void } },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};
type YTWindow = { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as unknown as YTWindow;
  if (w.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

type VideoSlideProps = {
  video: VideoAsset;
  /** true khi slide này đang hiển thị; false khi khách chuyển sang slide khác → dừng video. */
  active?: boolean;
  /** Gọi khi khách BẮT ĐẦU phát video → dừng tự chạy dải ảnh để khỏi cắt ngang clip. */
  onPlay?: () => void;
  /** Gọi khi video TẠM DỪNG → chạy lại dải ảnh ngay (không sang slide). */
  onPause?: () => void;
  /** Gọi khi video XEM HẾT → KHÔNG phát lại; đối xử như một tấm ảnh: đợi 3 giây rồi tự sang slide kế. */
  onEnded?: () => void;
};

/** Slide video trong carousel ảnh chính: YouTube/TikTok/Facebook → iframe embed; video thư viện → thẻ <video controls>.
 *  Video KHÔNG tự phát — khách phải bấm mới chạy. `onPlay`/`onPause`/`onEnded` chỉ phản
 *  ánh thao tác của khách để điều khiển dải ảnh tự chạy. */
export function VideoSlide({ video, active, onPlay, onPause, onEnded }: VideoSlideProps) {
  const url = video.url ?? "";
  const ytId = getYouTubeId(url);
  const tiktokId = ytId ? null : getTikTokId(url);
  const isFacebook = !ytId && !tiktokId && isFacebookVideoUrl(url);
  const resolved = resolveMediaUrl(url) ?? url;
  const title = video.title ?? "Video";

  // YouTube: gắn IFrame Player API vào iframe để bắt PLAYING (bấm play), PAUSED (tạm
  // dừng) và ENDED (xem hết). Không gọi destroy khi unmount để tránh xung đột gỡ DOM
  // với React — khi React gỡ iframe thì player cũng theo đó mất.
  const ytFrameRef = useRef<HTMLIFrameElement | null>(null);
  const ytFrameId = `yt-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!ytId) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !ytFrameRef.current) return;
      const YT = (window as unknown as YTWindow).YT;
      if (!YT?.Player) return;
      ytPlayerRef.current = new YT.Player(ytFrameRef.current, {
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.PLAYING) onPlay?.();
            else if (e.data === YT.PlayerState.PAUSED) onPause?.();
            else if (e.data === YT.PlayerState.ENDED) onEnded?.();
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ytId, onPlay, onPause, onEnded]);

  // Khi slide này bị deactivate (khách chuyển sang slide khác) → dừng video ngay.
  useEffect(() => {
    if (active !== false) return;
    ytPlayerRef.current?.pauseVideo?.();
    videoRef.current?.pause();
  }, [active]);

  if (ytId) {
    return (
      <iframe
        ref={ytFrameRef}
        id={ytFrameId}
        className="block w-full h-full border-none bg-black"
        // enablejsapi=1 để IFrame API điều khiển/lắng nghe được; KHÔNG có autoplay=1
        // nên video không tự phát, khách phải bấm.
        src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1`}
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
      ref={videoRef}
      className="block w-full h-full object-contain bg-black"
      src={resolved}
      controls
      playsInline
      poster={video.thumbnail?.url}
      onPlay={onPlay}
      onPause={onPause}
      onEnded={onEnded}
    />
  );
}
