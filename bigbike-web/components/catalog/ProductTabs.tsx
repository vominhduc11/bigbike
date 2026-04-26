"use client";

import { useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import type { ProductSpecification, VideoAsset } from "@/lib/contracts/public";

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
  } catch { /* invalid url */ }
  return null;
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
              const ytId = video.url ? getYouTubeId(video.url) : null;
              return (
                <article key={video.id ?? video.url ?? index} className="wp-pdp-video-card">
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
                  ) : (
                    <div className="wp-pdp-video-thumb">
                      <MediaImage
                        image={video.thumbnail ?? undefined}
                        altFallback={safeText(video.title, productName)}
                        width={960}
                        height={540}
                      />
                    </div>
                  )}
                  <h3 className="wp-video-title">{safeText(video.title, "Video sản phẩm")}</h3>
                  {video.url && !ytId && (
                    <a className="bb-link" href={video.url} target="_blank" rel="noreferrer">
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
