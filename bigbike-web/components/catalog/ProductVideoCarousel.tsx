"use client";

import { useState } from "react";
import { ProductHeroVideo } from "./ProductHeroVideo";
import type { VideoAsset } from "@/lib/contracts/public";

function isValidVideo(v: VideoAsset): boolean {
  const url = v.url ?? "";
  if (!url) return false;
  if (/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/.test(url))
    return true;
  const path = url.split(/[?#]/, 1)[0];
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(path);
}

export function ProductVideoCarousel({
  videos,
  productName,
}: {
  videos: VideoAsset[];
  productName: string;
}) {
  const valid = videos.filter(isValidVideo);
  const [index, setIndex] = useState(0);

  if (valid.length === 0) return null;
  if (valid.length === 1) return <ProductHeroVideo video={valid[0]} productName={productName} />;

  const clamp = (i: number) => Math.max(0, Math.min(valid.length - 1, i));

  return (
    <div className="flex flex-col gap-2">
      {/* key forces re-mount to reset the playing state when navigating */}
      <ProductHeroVideo key={index} video={valid[index]} productName={productName} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIndex((i) => clamp(i - 1))}
          disabled={index === 0}
          aria-label="Video trước"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-border text-foreground transition-colors hover:border-brand hover:text-brand disabled:pointer-events-none disabled:opacity-30"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="flex flex-1 items-center justify-center gap-1.5">
          {valid.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Video ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={`h-2 transition-all ${
                i === index ? "w-6 bg-brand" : "w-2 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIndex((i) => clamp(i + 1))}
          disabled={index === valid.length - 1}
          aria-label="Video tiếp theo"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-border text-foreground transition-colors hover:border-brand hover:text-brand disabled:pointer-events-none disabled:opacity-30"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
