"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  VideoOff,
  X,
} from "lucide-react";
import type { HomeVideo } from "@/lib/contracts/public";
import { isSafePublicHref, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { loadYouTubeApi, type YouTubePlayer } from "@/lib/youtube-player";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  facebookEmbedUrl,
  getTikTokId,
  isFacebookVideoUrl,
  tiktokEmbedUrl,
} from "@/components/catalog/product-gallery/media";

type VideoModalProps = {
  videos: HomeVideo[];
  activeIndex: number;
  onClose: () => void;
  onAfterClose?: () => void;
  onPrev: () => void;
  onNext: () => void;
};

const controlClass =
  "h-12 w-12 shrink-0 border-white/20 text-white hover:bg-white/10 hover:text-white hover:not-disabled:scale-100 focus-visible:outline-white";

function playbackSource(video: HomeVideo) {
  const fallbackUrl = !video.embedUrl && !video.youtubeId ? (video.videoUrl ?? "") : "";
  const tiktokId = getTikTokId(fallbackUrl);
  const embedSrc =
    video.embedUrl ||
    (video.youtubeId
      ? `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`
      : tiktokId
        ? tiktokEmbedUrl(tiktokId)
        : isFacebookVideoUrl(fallbackUrl)
          ? facebookEmbedUrl(fallbackUrl)
          : null);
  const rawSrc = embedSrc
    ? null
    : (resolveMediaUrl(video.videoUrl?.trim()) ?? video.videoUrl?.trim() ?? null);
  let youtube = false;
  let sourceUrl = video.videoUrl || rawSrc || embedSrc;
  if (embedSrc) {
    try {
      const url = new URL(embedSrc);
      youtube = [
        "youtube.com",
        "www.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
      ].includes(url.hostname);
      const id = url.pathname.match(/^\/embed\/([\w-]{11})$/)?.[1];
      if (youtube && id) sourceUrl = `https://www.youtube.com/watch?v=${id}`;
    } catch {
      // Preserve legacy embed reads; an invalid source gets the same retry UI.
    }
  }
  return { embedSrc, rawSrc, youtube, sourceUrl: isSafePublicHref(sourceUrl) ? sourceUrl : null };
}

type Source = ReturnType<typeof playbackSource>;

/** A keyed attempt owns its player, listeners and timeout; old events cannot affect the next video. */
function PlaybackAttempt({
  source,
  title,
  onRetry,
}: {
  source: Source;
  title: string;
  onRetry: () => void;
}) {
  const t = useTranslations("VideoViewer");
  const [state, setState] = useState<"loading" | "ready" | "slow" | "error">(
    source.embedSrc || source.rawSrc ? "loading" : "error",
  );
  const youtubeHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setState((current) => (current === "loading" ? "slow" : current)),
      12000,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!source.youtube || !source.embedSrc || !youtubeHost.current) return;
    let cancelled = false;
    let player: YouTubePlayer | undefined;
    let apiUnavailable = false;
    let frameLoaded = false;
    const frame = document.createElement("iframe");
    const url = new URL(source.embedSrc);
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("playsinline", "1");
    url.searchParams.set("origin", window.location.origin);
    frame.src = url.toString();
    frame.title = title;
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    const ready = () => {
      if (!cancelled) setState("ready");
    };
    frame.onload = () => {
      frameLoaded = true;
      // A plain iframe remains usable if the optional API script is blocked.
      if (apiUnavailable) ready();
    };
    frame.onerror = () => {
      if (!cancelled) setState("error");
    };
    youtubeHost.current.appendChild(frame);

    loadYouTubeApi()
      .then((api) => {
        if (cancelled) return;
        player = new api.Player(frame, {
          events: {
            onReady: ready,
            onAutoplayBlocked: ready,
            onError: () => {
              if (!cancelled) setState("error");
            },
            onStateChange: (event) => {
              if (event.data === 1) ready();
            },
          },
        });
      })
      .catch(() => {
        apiUnavailable = true;
        if (frameLoaded) ready();
      });

    return () => {
      cancelled = true;
      frame.onload = null;
      frame.onerror = null;
      try {
        player?.destroy?.();
      } catch {
        /* The provider may already have removed its iframe. */
      }
      frame.remove();
    };
  }, [source.embedSrc, source.youtube, title]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" data-video-state={state}>
      {source.youtube ? (
        <div
          ref={youtubeHost}
          className="absolute inset-0 [&_iframe]:block [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0"
        />
      ) : source.embedSrc ? (
        <iframe
          src={source.embedSrc}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      ) : source.rawSrc ? (
        <video
          src={`${source.rawSrc}#t=0.001`}
          className="absolute inset-0 h-full w-full bg-black object-contain"
          controls
          autoPlay
          playsInline
          aria-label={title}
          onLoadedData={() => setState("ready")}
          onCanPlay={() => setState("ready")}
          onError={() => setState("error")}
        />
      ) : null}
      {state === "loading" && (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white"
          role="status"
        >
          <LoaderCircle className="h-6 w-6 motion-safe:animate-spin" aria-hidden="true" />
          <span className="text-a4-content">{t("loading")}</span>
        </div>
      )}
      {(state === "slow" || state === "error") && (
        <div
          className="absolute inset-0 flex overflow-y-auto bg-surface-dark p-4 text-center text-white"
          role="status"
        >
          <div className="m-auto flex w-full flex-col items-center gap-3">
            <VideoOff className="h-6 w-6 shrink-0" aria-hidden="true" />
            <p className="m-0 text-a4-content leading-body">
              {t(state === "slow" ? "slow" : "error")}
            </p>
            {(source.embedSrc || source.rawSrc) && (
              <Button
                variant="ghost"
                onClick={onRetry}
                className="min-h-12 border-white/20 px-4 py-2 text-white hover:bg-white/10 hover:text-white focus-visible:outline-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t("retry")}
              </Button>
            )}
            {source.sourceUrl && (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-a4-content text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-white"
              >
                {t("openSource")}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VideoPlayback({ source, title }: { source: Source; title: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <PlaybackAttempt
      key={attempt}
      source={source}
      title={title}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

export function VideoModal(props: VideoModalProps) {
  if (!props.videos[props.activeIndex]) return null;
  return <VideoDialog {...props} />;
}

function VideoDialog({
  videos,
  activeIndex,
  onClose,
  onAfterClose,
  onPrev,
  onNext,
}: VideoModalProps) {
  const tA = useTranslations("A11y");
  const t = useTranslations("VideoViewer");
  const video = videos[activeIndex];
  const title = safeText(video.title, "");
  const description = safeText(video.description, "");
  const ariaTitle = title || tA("watchVideoFallback");
  const source = playbackSource(video);
  const closeRef = useRef<HTMLButtonElement>(null);
  const trigger = useRef(
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );
  const hasNavigation = videos.length > 1;

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    const prevGutter = document.body.style.scrollbarGutter;
    const prevHtmlGutter = document.documentElement.style.scrollbarGutter;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.scrollbarGutter = "auto";
    document.documentElement.style.scrollbarGutter = "auto";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.body.style.scrollbarGutter = prevGutter;
      document.documentElement.style.scrollbarGutter = prevHtmlGutter;
    };
  }, []);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        data-bb-video-modal="true"
        overlayClassName="bg-black/90 backdrop-blur-sm motion-reduce:animate-none"
        className="inset-0 left-0 top-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 items-center justify-center overflow-y-auto overscroll-contain rounded-none! border-0 bg-transparent pb-(--video-safe-bottom) pl-[max(var(--bb-space-4),env(safe-area-inset-left))] pr-[max(var(--bb-space-4),env(safe-area-inset-right))] pt-(--video-safe-top) text-white shadow-none [container-type:size] [--video-safe-top:max(var(--bb-space-4),env(safe-area-inset-top))] [--video-safe-bottom:max(var(--bb-space-4),env(safe-area-inset-bottom))] data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 motion-reduce:animate-none"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (onAfterClose) onAfterClose();
          else trigger.current?.focus({ preventScroll: true });
        }}
        onKeyDown={(event) => {
          if (
            !hasNavigation ||
            event.defaultPrevented ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return;
          if (
            (event.target as HTMLElement).closest(
              "video, iframe, input, textarea, [contenteditable=true]",
            )
          )
            return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            if (event.key === "ArrowLeft") onPrev();
            else onNext();
          }
        }}
      >
        <div
          data-video-layout
          className={cn(
            "grid h-full min-h-0 w-full max-w-(--bb-video-player-max-width) content-center grid-cols-[3rem_minmax(0,1fr)_3rem] grid-rows-[auto_minmax(var(--bb-video-player-min-size),calc(min(var(--bb-video-player-max-width),100cqw)*16/9))_auto_auto] gap-x-4 gap-y-3 [grid-template-areas:'header_header_header'_'player_player_player'_'description_description_description'_'prev_position_next']",
            "lg:max-w-[calc(var(--bb-video-player-max-width)+var(--bb-space-16)*2)] lg:[grid-template-areas:'._header_.'_'prev_player_next'_'._description_.'_'._position_.']",
            "[@media(orientation:landscape)_and_(max-height:600px)]:max-w-2xl [@media(orientation:landscape)_and_(max-height:600px)]:grid-cols-[max(var(--bb-video-player-min-size),calc((100dvh-var(--video-safe-top)-var(--video-safe-bottom))*9/16))_3rem_minmax(0,1fr)_3rem] [@media(orientation:landscape)_and_(max-height:600px)]:grid-rows-[auto_minmax(0,1fr)_auto] [@media(orientation:landscape)_and_(max-height:600px)]:[grid-template-areas:'player_header_header_header'_'player_description_description_description'_'player_prev_position_next']",
          )}
        >
          <div className="flex min-w-0 items-start gap-2 [grid-area:header]">
            <div className="max-h-[20dvh] min-w-0 flex-1 self-center overflow-y-auto overscroll-contain">
              <DialogTitle
                className={cn(
                  "m-0 break-words text-a4-content leading-title text-white [overflow-wrap:anywhere]",
                  !title && "sr-only",
                )}
              >
                {ariaTitle}
              </DialogTitle>
            </div>
            {source.sourceUrl && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className={cn(
                  controlClass,
                  "border-transparent text-(--bb-text-inverse-secondary)",
                )}
              >
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("openSource")}
                  title={t("openSource")}
                >
                  <ExternalLink className="h-5 w-5" aria-hidden="true" />
                </a>
              </Button>
            )}
            <Button
              ref={closeRef}
              variant="ghost"
              size="icon"
              className={controlClass}
              onClick={onClose}
              aria-label={tA("videoClose")}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>

          <div
            data-video-stage
            className="grid min-h-0 min-w-0 place-items-center [container-type:size] [grid-area:player]"
          >
            <div
              data-video-frame
              className="h-[min(100cqh,calc(100cqw*16/9))] w-[min(100cqw,max(var(--bb-video-player-min-size),calc(100cqh*9/16)))] max-w-(--bb-video-player-max-width) bg-black"
            >
              <VideoPlayback
                key={`${video.id}:${activeIndex}:${source.embedSrc}:${source.rawSrc}`}
                source={source}
                title={ariaTitle}
              />
            </div>
          </div>

          {description && (
            <div
              data-video-description
              className="max-h-[16dvh] min-h-0 overflow-y-auto overscroll-contain text-a4-content leading-body text-(--bb-text-inverse-secondary) [grid-area:description] [overflow-wrap:anywhere] [@media(orientation:landscape)_and_(max-height:600px)]:max-h-none"
            >
              <p className="m-0 whitespace-pre-line">{description}</p>
            </div>
          )}

          {hasNavigation && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(controlClass, "self-center [grid-area:prev]")}
                onClick={onPrev}
                aria-label={tA("videoPrev")}
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </Button>
              <p
                className="m-0 self-center text-center text-a5-meta tabular-nums text-(--bb-text-inverse-secondary) [grid-area:position]"
                aria-live="polite"
                aria-atomic="true"
                aria-label={t("position", { current: activeIndex + 1, total: videos.length })}
              >
                {activeIndex + 1} / {videos.length}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className={cn(controlClass, "self-center [grid-area:next]")}
                onClick={onNext}
                aria-label={tA("videoNext")}
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
