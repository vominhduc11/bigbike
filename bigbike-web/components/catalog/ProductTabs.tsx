"use client";

import { useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import type { ProductSpecification, VideoAsset } from "@/lib/contracts/public";

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  // Covers watch?v=, share (youtu.be/), embed/, shorts/, and /v/ paths.
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function isUploadedVideoUrl(url: string): boolean {
  if (!url) return false;
  // Strip query/hash before extension check.
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

export function ProductTabs({ specifications, description, videos, productName }: ProductTabsProps) {
  const hasDescription = Boolean(description?.trim());
  const hasSpecs = specifications.length > 0;
  const hasVideos = videos.length > 0;

  const firstTab: TabId = hasDescription ? "description" : hasSpecs ? "specs" : "videos";
  const [active, setActive] = useState<TabId>(firstTab);

  if (!hasDescription && !hasSpecs && !hasVideos) return null;

  return (
    <div className="wp-pdp-tabs">
      <div className="wp-pdp-tab-list" role="tablist">
        {hasDescription && (
          <button
            role="tab"
            type="button"
            aria-selected={active === "description"}
            className={`wp-pdp-tab${active === "description" ? " active" : ""}`}
            onClick={() => setActive("description")}
          >
            Mô tả sản phẩm
          </button>
        )}
        {hasSpecs && (
          <button
            role="tab"
            type="button"
            aria-selected={active === "specs"}
            className={`wp-pdp-tab${active === "specs" ? " active" : ""}`}
            onClick={() => setActive("specs")}
          >
            Thông số kỹ thuật
          </button>
        )}
        {hasVideos && (
          <button
            role="tab"
            type="button"
            aria-selected={active === "videos"}
            className={`wp-pdp-tab${active === "videos" ? " active" : ""}`}
            onClick={() => setActive("videos")}
          >
            Video
            <span className="wp-pdp-tab-count">{videos.length}</span>
          </button>
        )}
      </div>

      <div className="wp-pdp-tab-panel">
        {active === "description" && hasDescription && (
          <article
            className="bb-richtext wp-article-body"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(description!) }}
          />
        )}

        {active === "specs" && hasSpecs && (
          <table className="bb-spec-table">
            <tbody>
              {specifications.map((spec) => (
                <tr key={`${spec.group}-${spec.name}`}>
                  <td>{safeText(spec.name, "Thông tin")}</td>
                  <td>{safeText(spec.value, "Đang cập nhật")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {active === "videos" && hasVideos && (
          <div className="wp-pdp-videos">
            {videos.map((video, index) => {
              const url = video.url ?? "";
              const ytId = url ? getYouTubeId(url) : null;
              // Treat as uploaded video when admin marked provider=upload OR
              // the URL has a recognizable video file extension.
              const isUpload =
                !ytId && (video.provider === "upload" || isUploadedVideoUrl(url));
              const posterImage = video.thumbnail ?? undefined;
              return (
                <article key={video.id ?? url ?? index} className="wp-pdp-video-card">
                  {ytId ? (
                    <div className="wp-pdp-video-embed">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        title={safeText(video.title, "Video sản phẩm")}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                  ) : isUpload && url ? (
                    <div className="wp-pdp-video-embed">
                      <video
                        src={url}
                        controls
                        preload="metadata"
                        playsInline
                        poster={posterImage?.url}
                      />
                    </div>
                  ) : (
                    <div className="wp-pdp-video-thumb">
                      <MediaImage
                        image={posterImage}
                        altFallback={safeText(video.title, productName)}
                        width={960}
                        height={540}
                      />
                    </div>
                  )}
                  <h3 className="wp-video-title">{safeText(video.title, "Video sản phẩm")}</h3>
                  {url && !ytId && !isUpload && (
                    <a className="bb-link" href={url} target="_blank" rel="noreferrer">
                      Xem video →
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
