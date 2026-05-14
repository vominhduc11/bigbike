"use client";

import { MediaImage } from "@/components/ui/MediaImage";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import type { ProductSpecification, VideoAsset } from "@/lib/contracts/public";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  videos: VideoAsset[];
  productName: string;
};

type TabId = "description" | "specs" | "videos";

function descriptionHasContent(html: string | null | undefined): boolean {
  if (!html) return false;
  if (/<(img|iframe|video)[^>]*>/i.test(html)) return true;
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

export function ProductTabs({ specifications, description, videos, productName }: ProductTabsProps) {
  const sanitizedDescription = description ? sanitizeRichHtml(description) : "";
  const hasDescription = descriptionHasContent(sanitizedDescription);
  const hasSpecs = specifications.length > 0;
  const hasVideos = videos.length > 0;

  if (!hasDescription && !hasSpecs && !hasVideos) return null;

  const defaultTab: TabId = hasDescription ? "description" : hasSpecs ? "specs" : "videos";

  return (
    <Tabs defaultValue={defaultTab} className="bb-pdp-tabs">
      <TabsList className="w-full justify-start overflow-x-auto">
        {hasDescription && (
          <TabsTrigger value="description">Mô tả sản phẩm</TabsTrigger>
        )}
        {hasSpecs && (
          <TabsTrigger value="specs">Thông số kỹ thuật</TabsTrigger>
        )}
        {hasVideos && (
          <TabsTrigger value="videos" className="gap-1.5">
            Video
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-primary text-primary-foreground text-xs font-bold leading-none">
              {videos.length}
            </span>
          </TabsTrigger>
        )}
      </TabsList>

      {hasDescription && (
        <TabsContent value="description" className="bb-pdp-tab-panel pt-4">
          <article
            className="bb-richtext bb-article-body"
            dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
          />
        </TabsContent>
      )}

      {hasSpecs && (
        <TabsContent value="specs" className="bb-pdp-tab-panel pt-4">
          <table className="bb-spec-table">
            <tbody>
              {specifications.flatMap((spec, idx) => {
                const group = spec.group?.trim() || null;
                const prevGroup = idx > 0 ? (specifications[idx - 1].group?.trim() || null) : "__none__";
                const showHeader = group !== null && group !== prevGroup;
                return [
                  ...(showHeader
                    ? [
                        <tr key={`group-${idx}`} className="bb-spec-group-header">
                          <th colSpan={2}>{group}</th>
                        </tr>,
                      ]
                    : []),
                  <tr key={`${idx}-${spec.name}`}>
                    <td>{safeText(spec.name, "Thông số")}</td>
                    <td>{safeText(spec.value, "Đang cập nhật")}</td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </TabsContent>
      )}

      {hasVideos && (
        <TabsContent value="videos" className="bb-pdp-tab-panel pt-4">
          <div className="bb-pdp-videos">
            {videos.map((video, index) => {
              const url = video.url ?? "";
              const ytId = url ? getYouTubeId(url) : null;
              const isUpload =
                !ytId && (video.provider === "upload" || isUploadedVideoUrl(url));
              const posterImage = video.thumbnail ?? undefined;
              return (
                <article key={video.id ?? url ?? index} className="bb-pdp-video-card">
                  {ytId ? (
                    <div className="bb-pdp-video-embed">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        title={safeText(video.title, "Video sản phẩm")}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                  ) : isUpload && url ? (
                    <div className="bb-pdp-video-embed">
                      <video
                        src={url}
                        controls
                        preload="metadata"
                        playsInline
                        poster={posterImage?.url}
                      />
                    </div>
                  ) : (
                    <div className="bb-pdp-video-thumb">
                      <MediaImage
                        image={posterImage}
                        altFallback={safeText(video.title, productName)}
                        width={960}
                        height={540}
                      />
                    </div>
                  )}
                  <h3 className="bb-video-title">{safeText(video.title, "Video sản phẩm")}</h3>
                  {url && !ytId && !isUpload && (
                    <a className="bb-link" href={url} target="_blank" rel="noreferrer">
                      Xem video →
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
