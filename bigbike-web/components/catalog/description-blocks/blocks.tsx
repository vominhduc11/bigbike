import { Check } from "lucide-react";

import type { DescriptionBlock, SizeGuideSection, SuitabilitySection } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { facebookEmbedUrl, getTikTokId, isFacebookVideoUrl, tiktokEmbedUrl } from "../product-gallery/media";
import type { FeatureBlockT } from "./grouping";

const PDP_RICH_HTML_OPTS = { allowInlineStyles: true, rewriteMediaUrls: true } as const;

function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function MediaBlock({ block }: { block: DescriptionBlock }) {
  if (block.type === "image") {
    const src = resolveMediaUrl(block.url?.trim()) || "";
    if (!src) return null;
    return (
      <figure className="m-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={block.alt || ""}
          loading="lazy"
          className="w-full border border-border object-cover"
        />
        {block.caption ? (
          <figcaption className="mt-2 text-ui-14 max-md:text-ui-12 italic text-muted-foreground">{block.caption}</figcaption>
        ) : null}
      </figure>
    );
  }
  if (block.type === "video") {
    const raw = block.url?.trim() || "";
    if (!raw) return null;
    const id = block.provider === "upload" ? null : youTubeId(raw);
    const tiktokId = id || block.provider === "upload" ? null : getTikTokId(raw);
    const isFacebook = id || tiktokId || block.provider === "upload" ? false : isFacebookVideoUrl(raw);
    return (
      <figure className="m-0">
        <div className="relative w-full overflow-hidden border border-border [aspect-ratio:16/9]">
          {id ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
              title={block.caption || "Video"}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              loading="lazy"
            />
          ) : tiktokId ? (
            <iframe
              src={tiktokEmbedUrl(tiktokId)}
              title={block.caption || "Video"}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              loading="lazy"
            />
          ) : isFacebook ? (
            <iframe
              src={facebookEmbedUrl(raw)}
              title={block.caption || "Video"}
              className="absolute inset-0 h-full w-full border-0"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
              loading="lazy"
            />
          ) : (
            <video src={resolveMediaUrl(raw) || raw} controls className="absolute inset-0 h-full w-full bg-black" />
          )}
        </div>
        {block.caption ? (
          <figcaption className="mt-2 text-ui-14 max-md:text-ui-12 italic text-muted-foreground">{block.caption}</figcaption>
        ) : null}
      </figure>
    );
  }
  return null;
}

function TextBlock({ block }: { block: DescriptionBlock }) {
  switch (block.type) {
    case "heading": {
      const text = block.text?.trim();
      if (!text) return null;
      const small = block.level === 3;
      return small ? (
        <h3 className="font-heading text-ui-20 max-md:text-ui-18 font-bold uppercase leading-tight text-foreground">{text}</h3>
      ) : (
        // Thanh nhấn đỏ DỌC bên trái, tự cao bằng cả khối tiêu đề (self-stretch) — cân đối với tiêu đề
        // dài nhiều dòng, không còn căn giữa lệch theo dòng đầu như trước.
        <h2 className="flex gap-3 font-heading text-ui-20 max-md:text-ui-18 font-bold uppercase leading-tight text-foreground">
          <span className="w-1 shrink-0 self-stretch bg-brand" aria-hidden />
          <span>{text}</span>
        </h2>
      );
    }
    case "paragraph": {
      const html = block.html?.trim();
      if (!html) return null;
      return <div className="wyswyg text-ui-18 max-md:text-ui-16" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html, PDP_RICH_HTML_OPTS) }} />;
    }
    case "list": {
      const items = (block.items ?? []).map((it) => (it ?? "").trim()).filter(Boolean);
      if (items.length === 0) return null;
      if (block.style === "numbered") {
        return (
          <ol className="flex list-none flex-col gap-2 text-ui-18 max-md:text-ui-16 leading-snug">
            {items.map((it, idx) => (
              <li key={idx} className="flex gap-2.5 text-foreground">
                <span className="font-heading font-bold text-brand">{idx + 1}.</span>
                <span>{it}</span>
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="flex list-none flex-col gap-2 text-ui-18 max-md:text-ui-16 leading-snug">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2.5 text-foreground">
              <Check className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "callout": {
      const html = block.html?.trim();
      if (!html) return null;
      return (
        <div className="border-l-4 border-brand bg-muted px-4 py-3">
          <div className="wyswyg text-ui-18 max-md:text-ui-16" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html, PDP_RICH_HTML_OPTS) }} />
        </div>
      );
    }
    default:
      return null;
  }
}

export function TextStack({ blocks }: { blocks: DescriptionBlock[] }) {
  return (
    // gap-4 = nới khoảng giữa tiêu đề và đoạn/danh sách bên dưới (đồng bộ với khối feature).
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => (
        <TextBlock key={i} block={b} />
      ))}
    </div>
  );
}

/** Render phần CHỮ của khối feature từ các field phẳng (heading / html / list) — đồng style với TextBlock. */
export function FeatureBody({ block }: { block: FeatureBlockT }) {
  const subheading = block.subheading?.trim();
  const heading = block.heading?.trim();
  const html = block.html?.trim();
  const items = (block.items ?? []).map((it) => (it ?? "").trim()).filter(Boolean);
  return (
    // gap-4 = khoảng cách lớn hơn giữa cụm TIÊU ĐỀ và phần nội dung/danh sách bên dưới.
    <div className="flex flex-col gap-4">
      {/* Cụm tiêu đề: eyebrow bám SÁT tiêu đề chính (gap-1.5) — coi như một khối, tách hẳn với body. */}
      {subheading || heading ? (
        <div className="flex flex-col gap-1.5">
          {subheading ? (
            // Tiêu đề phụ (eyebrow) — nhãn nhỏ in hoa màu brand, phía trên tiêu đề chính.
            // text-ui-14 = 14px CỐ ĐỊNH (thang PDP §nhỏ; không dùng text-caption rem vì gốc 14px → 12.25px).
            <p className="!mb-0 font-heading text-ui-14 max-md:text-ui-12 font-bold uppercase tracking-display text-brand">
              {subheading}
            </p>
          ) : null}
          {heading ? (
            // text-ui-20 = 20px CỐ ĐỊNH — thang PDP §tiêu đề phụ (heading trong mô tả), trên nội dung 18px.
            <h2 className="flex gap-3 font-heading text-ui-20 max-md:text-ui-18 font-bold uppercase leading-tight text-foreground">
              <span className="w-1 shrink-0 self-stretch bg-brand" aria-hidden />
              <span>{heading}</span>
            </h2>
          ) : null}
        </div>
      ) : null}
      {html ? <div className="wyswyg text-ui-18 max-md:text-ui-16" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html, PDP_RICH_HTML_OPTS) }} /> : null}
      {items.length > 0 ? (
        block.listStyle === "numbered" ? (
          <ol className="flex list-none flex-col gap-2 text-ui-18 max-md:text-ui-16 leading-snug">
            {items.map((it, idx) => (
              <li key={idx} className="flex gap-2.5 text-foreground">
                <span className="font-heading font-bold text-brand">{idx + 1}.</span>
                <span>{it}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="flex list-none flex-col gap-2 text-ui-18 max-md:text-ui-16 leading-snug">
            {items.map((it, idx) => (
              <li key={idx} className="flex gap-2.5 text-foreground">
                <Check className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

/** Tiêu đề khối tuỳ chọn (thanh nhấn đỏ dọc), đồng style với heading block. */
function BlockTitle({ text }: { text?: string }) {
  const t = (text ?? "").trim();
  if (!t) return null;
  return (
    <h2 className="flex gap-3 font-heading text-ui-20 max-md:text-ui-18 font-bold uppercase leading-tight text-foreground">
      <span className="w-1 shrink-0 self-stretch bg-brand" aria-hidden />
      <span>{t}</span>
    </h2>
  );
}

/** Khối "Phù hợp với ai" (V246) — HTML tự do (danh sách thẻ tư vấn), sanitize trước khi render. */
export function SuitabilityBlockView({ block }: { block: SuitabilitySection }) {
  // html là nguồn render; cho phép CSS inline để admin tự chỉnh giao diện khi dán HTML.
  const html = block.html ? sanitizeRichHtml(block.html, PDP_RICH_HTML_OPTS) : "";
  if (!html) return null;
  return (
    // gap-4 = khoảng tiêu đề→nội dung, đồng nhất với TextStack/FeatureBody (16px mọi loại khối).
    <div className="flex flex-col gap-4">
      <BlockTitle text={block.title} />
      <div className="wyswyg text-ui-18 max-md:text-ui-16" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** Khối "Bảng size" (V246) — HTML tự do (thường là bảng), sanitize trước khi render. */
export function SizeGuideBlockView({ block }: { block: SizeGuideSection }) {
  // html là nguồn render; cho phép CSS inline để admin tự chỉnh giao diện khi dán HTML.
  const html = block.html ? sanitizeRichHtml(block.html, PDP_RICH_HTML_OPTS) : "";
  if (!html) return null;
  return (
    // gap-4 = khoảng tiêu đề→nội dung, đồng nhất với TextStack/FeatureBody (16px mọi loại khối).
    <div className="flex flex-col gap-4">
      <BlockTitle text={block.title} />
      <div className="wyswyg text-ui-18 max-md:text-ui-16" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
