"use client";

import { useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import type { ProductSpecification, VideoAsset } from "@/lib/contracts/public";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  // Covers watch?v=, share (youtu.be/), embed/, shorts/, and /v/ paths.
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function isUploadedVideoUrl(url: string): boolean {
  if (!url) return false;
  const path = url.split(/[?#]/, 1)[0];
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(path);
}

type ProductTabsProps = {
  specifications: ProductSpecification[];
  description: string | null | undefined;
  promotionContent: string | null | undefined;
  videos: VideoAsset[];
  productName: string;
};

type TabId = "promotion" | "description" | "videos" | "specs";

function richHasContent(html: string | null | undefined): boolean {
  if (!html) return false;
  if (/<(img|iframe|video)[^>]*>/i.test(html)) return true;
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

/** Single video frame — YouTube embed, uploaded file, or poster fallback. */
function VideoFrame({ video, productName }: { video: VideoAsset; productName: string }) {
  const url = video.url ?? "";
  const ytId = url ? getYouTubeId(url) : null;
  const isUpload = !ytId && (video.provider === "upload" || isUploadedVideoUrl(url));
  const poster = video.thumbnail ?? undefined;

  if (ytId) {
    return (
      <div className="relative aspect-video overflow-hidden bg-[#0a0a0a]">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          title={safeText(video.title, "Video sản phẩm")}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 h-full w-full border-0 bg-black"
        />
      </div>
    );
  }
  if (isUpload && url) {
    return (
      <div className="relative aspect-video overflow-hidden bg-[#0a0a0a]">
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          poster={poster?.url}
          className="absolute inset-0 h-full w-full border-0 bg-black"
        />
      </div>
    );
  }
  return (
    <div className="aspect-video overflow-hidden bg-[#141414]">
      <MediaImage
        image={poster}
        altFallback={safeText(video.title, productName)}
        width={960}
        height={540}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

/** Video tab — large active player on the left, clickable playlist on the right. */
function VideoTabContent({ videos, productName }: { videos: VideoAsset[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const current = videos[activeIndex] ?? videos[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
      {/* Active player */}
      <div className="min-w-0">
        <VideoFrame video={current} productName={productName} />
        <h3 className="mt-3 text-sm font-semibold text-foreground">
          {safeText(current.title, "Video sản phẩm")}
        </h3>
      </div>

      {/* Playlist */}
      <div className="flex flex-col gap-3 lg:max-h-[460px] lg:overflow-y-auto lg:pr-1">
        {videos.map((video, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={video.id ?? video.url ?? index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "flex items-start gap-3 border bg-white p-2 text-left transition-colors",
                active
                  ? "border-black"
                  : "border-[color:var(--bb-border-default)] hover:border-foreground",
              )}
              aria-pressed={active}
            >
              <span className="relative block aspect-video w-28 shrink-0 overflow-hidden bg-[#141414]">
                <MediaImage
                  image={video.thumbnail ?? undefined}
                  altFallback={safeText(video.title, productName)}
                  width={224}
                  height={126}
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </span>
              </span>
              <span className="min-w-0 flex-1 text-sm leading-snug text-muted-foreground">
                {safeText(video.title, "Video sản phẩm")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProductTabs({
  specifications,
  description,
  promotionContent,
  videos,
  productName,
}: ProductTabsProps) {
  const sanitizedDescription = description ? sanitizeRichHtml(description) : "";
  const sanitizedPromotion = promotionContent ? sanitizeRichHtml(promotionContent) : "";
  const hasPromotion = richHasContent(sanitizedPromotion);
  const hasDescription = richHasContent(sanitizedDescription);
  const hasSpecs = specifications.length > 0;
  const hasVideos = videos.length > 0;

  if (!hasPromotion && !hasDescription && !hasSpecs && !hasVideos) return null;

  // First populated tab in display order becomes the default.
  const defaultTab: TabId = hasPromotion
    ? "promotion"
    : hasDescription
      ? "description"
      : hasVideos
        ? "videos"
        : "specs";

  return (
    <Tabs defaultValue={defaultTab} className="mt-0 mb-10">
      <TabsList className="bb-pdp-tabs-list">
        {hasPromotion && (
          <TabsTrigger value="promotion" className="bb-pdp-tab">
            <span className="bb-pdp-tab-label">Khuyến mãi</span>
          </TabsTrigger>
        )}
        {hasDescription && (
          <TabsTrigger value="description" className="bb-pdp-tab">
            <span className="bb-pdp-tab-label">Mô tả sản phẩm</span>
          </TabsTrigger>
        )}
        {hasVideos && (
          <TabsTrigger value="videos" className="bb-pdp-tab">
            <span className="bb-pdp-tab-label">Video</span>
          </TabsTrigger>
        )}
        {hasSpecs && (
          <TabsTrigger value="specs" className="bb-pdp-tab">
            <span className="bb-pdp-tab-label">Thông số kỹ thuật</span>
          </TabsTrigger>
        )}
      </TabsList>

      {hasPromotion && (
        <TabsContent value="promotion" className="pt-7 pb-8">
          <article
            className="bb-richtext bb-article-body"
            dangerouslySetInnerHTML={{ __html: sanitizedPromotion }}
          />
        </TabsContent>
      )}

      {hasDescription && (
        <TabsContent value="description" className="pt-7 pb-8">
          <article
            className="bb-richtext bb-article-body"
            dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
          />
        </TabsContent>
      )}

      {hasVideos && (
        <TabsContent value="videos" className="pt-7 pb-8">
          <VideoTabContent videos={videos} productName={productName} />
        </TabsContent>
      )}

      {hasSpecs && (
        <TabsContent value="specs" className="pt-7 pb-8">
          <table className="w-full border-collapse">
            <tbody>
              {specifications.flatMap((spec, idx) => {
                const group = spec.group?.trim() || null;
                const prevGroup = idx > 0 ? (specifications[idx - 1].group?.trim() || null) : "__none__";
                const showHeader = group !== null && group !== prevGroup;
                return [
                  ...(showHeader
                    ? [
                        <tr key={`group-${idx}`}>
                          <th colSpan={2}>{group}</th>
                        </tr>,
                      ]
                    : []),
                  <tr key={`${idx}-${spec.name}`}>
                    <td className="w-[36%] border-b border-border py-2 align-top text-muted-foreground">
                      {safeText(spec.name, "Thông số")}
                    </td>
                    <td className="border-b border-border py-2 align-top">
                      {safeText(spec.value, "Đang cập nhật")}
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </TabsContent>
      )}
    </Tabs>
  );
}
