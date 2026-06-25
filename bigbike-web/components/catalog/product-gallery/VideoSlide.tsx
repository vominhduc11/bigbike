"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { facebookEmbedUrl, getTikTokId, getYouTubeId, isFacebookVideoUrl, tiktokEmbedUrl } from "./media";

// Nạp YouTube IFrame API một lần cho cả trang. Dùng để biết khi khách BẤM PLAY và
// khi video XEM HẾT (YouTube nhúng iframe chéo miền nên không có sự kiện DOM trực
// tiếp). Không hề tự phát — chỉ lắng nghe trạng thái người dùng thao tác.
type YTPlayer = { destroy?: () => void; pauseVideo?: () => void };
type YTPlayerOptions = {
  width?: string | number;
  height?: string | number;
  videoId?: string;
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

  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytFrameId = `yt-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // Khi YouTube API bị chặn (adblock/mạng) thì sau ~4s vẫn không gắn được player →
  // hạ xuống iframe nhúng thường để video VẪN xem được (đánh đổi: lúc này không bắt
  // được sự kiện play nên dải ảnh không tự dừng — trường hợp hiếm).
  const [ytFallback, setYtFallback] = useState(false);

  // YouTube: ĐỂ CHÍNH API tự dựng iframe từ một <div> rỗng (thay vì gắn vào iframe có
  // sẵn — kiểu cũ khiến onStateChange thường KHÔNG bắn → dải ảnh không biết video đang
  // chạy và vẫn nhảy slide). API tự dựng iframe nên sự kiện PLAYING/PAUSED/ENDED bắn
  // tin cậy. Bọc trong wrapper: API thay thế <div> con bằng iframe của nó; React chỉ
  // quản <div> ngoài nên không xung đột khi gỡ DOM.
  useEffect(() => {
    if (!ytId) return;
    let cancelled = false;
    let player: YTPlayer | null = null;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) setYtFallback(true);
    }, 4000);
    loadYouTubeApi().then(() => {
      if (cancelled) return;
      const YT = (window as unknown as YTWindow).YT;
      if (!YT?.Player || !ytHostRef.current) {
        setYtFallback(true);
        return;
      }
      window.clearTimeout(fallbackTimer);
      player = new YT.Player(ytHostRef.current, {
        width: "100%",
        height: "100%",
        videoId: ytId,
        // KHÔNG có autoplay → khách phải bấm mới chạy. playsinline để iOS không ép
        // mở toàn màn hình; rel=0 hạn chế gợi ý video lạ khi xem hết.
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.PLAYING) onPlay?.();
            else if (e.data === YT.PlayerState.PAUSED) onPause?.();
            else if (e.data === YT.PlayerState.ENDED) onEnded?.();
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
        // iframe có thể đã bị React gỡ trước — bỏ qua.
      }
      ytPlayerRef.current = null;
    };
  }, [ytId, onPlay, onPause, onEnded]);

  // Khi slide này bị deactivate (khách chuyển sang slide khác) → dừng video ngay.
  useEffect(() => {
    if (active !== false) return;
    try {
      ytPlayerRef.current?.pauseVideo?.();
    } catch {
      // player có thể chưa sẵn sàng — bỏ qua.
    }
    videoRef.current?.pause();
  }, [active]);

  if (ytId && !ytFallback) {
    return (
      <div className="relative block h-full w-full bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0">
        {/* <div> này bị YouTube API thay bằng iframe của nó. */}
        <div ref={ytHostRef} id={ytFrameId} />
      </div>
    );
  }

  if (ytId && ytFallback) {
    return (
      <iframe
        className="block w-full h-full border-none bg-black"
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
