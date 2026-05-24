"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

type WpArticleImageProps = {
  src: string | null;
  fallbackSrc?: string | null;
  alt: string;
};

export function WpArticleImage({ src, fallbackSrc, alt }: WpArticleImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!currentSrc || failed) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const image = imageRef.current;

      if (!image) {
        return;
      }

      if (image.naturalWidth > 0) {
        window.clearInterval(timer);
        return;
      }

      if (image.complete && image.naturalWidth === 0) {
        window.clearInterval(timer);
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
          return;
        }
        setFailed(true);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [currentSrc, failed, fallbackSrc]);

  if (!currentSrc || failed) {
    return (
      <span className="bb-news-img bb-news-img-placeholder" aria-label={alt}>
        <span className="bb-news-img-placeholder-mark">BigBike</span>
      </span>
    );
  }

  return (
    <img
      ref={imageRef}
      src={currentSrc}
      data-fallback-src={fallbackSrc ?? undefined}
      alt={alt}
      className="bb-news-img"
      loading="lazy"
      decoding="async"
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
          return;
        }
        setFailed(true);
      }}
    />
  );
}
