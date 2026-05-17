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
    <Tabs defaultValue={defaultTab} className="mt-0 mb-10">
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
        <TabsContent value="description" className="pt-7 pb-8">
          <article
            className="bb-richtext bb-article-body"
            dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
          />
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

      {hasVideos && (
        <TabsContent value="videos" className="pt-7 pb-8">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-6">
            {videos.map((video, index) => {
              const url = video.url ?? "";
              const ytId = url ? getYouTubeId(url) : null;
              const isUpload =
                !ytId && (video.provider === "upload" || isUploadedVideoUrl(url));
              const posterImage = video.thumbnail ?? undefined;
              return (
                <article key={video.id ?? url ?? index} className="flex flex-col gap-3">
                  {ytId ? (
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
                  ) : isUpload && url ? (
                    <div className="relative aspect-video overflow-hidden bg-[#0a0a0a]">
                      <video
                        src={url}
                        controls
                        preload="metadata"
                        playsInline
                        poster={posterImage?.url}
                        className="absolute inset-0 h-full w-full border-0 bg-black"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video overflow-hidden bg-[#141414]">
                      <MediaImage
                        image={posterImage}
                        altFallback={safeText(video.title, productName)}
                        width={960}
                        height={540}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{safeText(video.title, "Video sản phẩm")}</h3>
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
