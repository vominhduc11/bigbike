export type YouTubePlayer = {
  destroy?: () => void;
  pauseVideo?: () => void;
  getPlayerState?: () => number;
};

export type YouTubePlayerOptions = {
  width?: string | number;
  height?: string | number;
  videoId?: string;
  host?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onError?: (event: { data: number }) => void;
    onAutoplayBlocked?: () => void;
    onStateChange?: (event: { data: number }) => void;
  };
};

export type YouTubeApi = {
  Player: new (element: HTMLElement | string, options: YouTubePlayerOptions) => YouTubePlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};

type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<YouTubeApi> | null = null;

/** Shared by the gallery and modal; loading starts only after a play action. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  const host = window as YouTubeWindow;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = host.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;

    const cleanup = () => {
      window.clearTimeout(timeout);
      script.onerror = null;
      if (host.onYouTubeIframeAPIReady === ready) host.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => {
      cleanup();
      script.remove();
      apiPromise = null;
      reject(new Error("YouTube player API unavailable"));
    };
    const ready = () => {
      cleanup();
      if (host.YT?.Player) resolve(host.YT);
      else {
        script.remove();
        apiPromise = null;
        reject(new Error("YouTube player API unavailable"));
      }
      previous?.();
    };
    const timeout = window.setTimeout(fail, 12000);
    host.onYouTubeIframeAPIReady = ready;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return apiPromise;
}
