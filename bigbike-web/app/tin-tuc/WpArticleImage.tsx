"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

type WpArticleImageProps = {
  src: string | null;
  fallbackSrc?: string | null;
  alt: string;
};

const TRANSPARENT_THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169' viewBox='0 0 300 169'%3E%3C/svg%3E";

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
      <img
        src={TRANSPARENT_THUMBNAIL}
        alt={alt}
        className="lazy bb-news-img-placeholder"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <img
      ref={imageRef}
      src={currentSrc}
      data-src={currentSrc}
      data-fallback-src={fallbackSrc ?? undefined}
      alt={alt}
      className="lazy"
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
