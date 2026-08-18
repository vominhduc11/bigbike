"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ArticleImageProps = {
  src: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  sizes: string;
};

const TRANSPARENT_THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169' viewBox='0 0 300 169'%3E%3C/svg%3E";

export function ArticleImage({ src, fallbackSrc, alt, className, sizes }: ArticleImageProps) {
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
      // Transparent fallback is already a complete data URI; optimization would add no value.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={TRANSPARENT_THUMBNAIL}
        alt={alt}
        className={cn("bg-secondary", className)}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <Image
      ref={imageRef}
      src={currentSrc}
      data-src={currentSrc}
      data-fallback-src={fallbackSrc ?? undefined}
      alt={alt}
      width={600}
      height={338}
      sizes={sizes}
      className={className}
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
