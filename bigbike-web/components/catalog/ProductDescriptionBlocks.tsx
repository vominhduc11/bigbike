"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import type { DescriptionBlock } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { cn } from "@/lib/utils";

/**
 * Hiển thị phần mô tả sản phẩm TỪ các khối có cấu trúc (admin dựng bằng BlockEditor) theo phong cách
 * mockup PDP — nhưng dùng màu/font của design system web (token brand, font-heading), KHÔNG hardcode.
 *
 * Bố cục cố định, dễ đoán cho admin:
 *  • Khối `feature` (ảnh + tiêu đề + đoạn + danh sách trong MỘT khối) → một "hàng tính năng" 2 cột
 *    ảnh–chữ, xen kẽ trái/phải khi `side`="auto"/null (giống mockup); "left"/"right" ép vị trí ảnh.
 *    KHÔNG còn ghép ngầm `image`/`video` + cụm chữ liền sau như trước.
 *  • Cụm chữ rộng hết khổ, NGẮT THÀNH TỪNG MỤC tại mỗi tiêu đề: một tiêu đề + các đoạn/danh sách/ghi chú
 *    đi liền sau nó = một mục, dừng trước tiêu đề kế tiếp. Mỗi mục được kẻ vạch chia (xem
 *    DescriptionBlocksView) nên mô tả nhập từ web cũ (toàn đoạn văn + ít tiêu đề) không còn dồn thành
 *    "một bức tường chữ" — khách quét nội dung theo từng mục dễ hơn.
 *  • Ảnh/Video đứng một mình → khung ảnh rộng hết khổ.
 *
 * Đổi ngôn ngữ: bản EN lấy qua `useLocalizedField("descriptionBlocks")` (client refetch, giữ ISR/SEO);
 * khi không có khối nào (sản phẩm legacy chỉ có HTML) → render `fallback` (tab mô tả HTML cũ).
 */

type FeatureBlockT = Extract<DescriptionBlock, { type: "feature" }>;
type SuitabilityBlockT = Extract<DescriptionBlock, { type: "suitability" }>;
type SizeGuideBlockT = Extract<DescriptionBlock, { type: "sizeGuide" }>;

/** Chữ KHÔNG phải tiêu đề — phần thân của một mục, gom liền sau tiêu đề cho tới tiêu đề kế tiếp. */
const NON_HEADING_TEXT = new Set(["paragraph", "list", "callout"]);

/** Các loại khối render được dưới dạng cụm CHỮ (flow): tiêu đề + thân. Loại NGOÀI tập này mà không phải
 *  feature/image/video/suitability/sizeGuide (vd "prosCons" — vốn render bằng khối RIÊNG ngoài mô tả) bị
 *  BỎ QUA, không tạo flow rỗng để khỏi sinh section trắng chỉ còn vạch kẻ + khoảng hở. */
const FLOW_TYPES = new Set(["heading", "paragraph", "list", "callout"]);

type Group =
  | { kind: "feature"; block: FeatureBlockT; reverse: boolean }
  | { kind: "media"; media: DescriptionBlock }
  | { kind: "flow"; blocks: DescriptionBlock[] }
  | { kind: "suitability"; block: SuitabilityBlockT }
  | { kind: "sizeGuide"; block: SizeGuideBlockT }
  | { kind: "divider" };

/**
 * Gom mảng khối phẳng thành các nhóm bố cục (hàng ảnh+chữ / khối chữ / ảnh đơn / đường kẻ).
 *
 * Hàng 2 cột ảnh–chữ giờ là MỘT khối `feature` tường minh (admin dựng), KHÔNG còn ghép ngầm
 * `image`/`video` + cụm chữ liền sau như trước. Khối `feature` có `side` = "auto"/null thì các
 * khối liên tiếp tự xen kẽ trái/phải (so le); "left"/"right" ép vị trí ảnh.
 */
function groupBlocks(blocks: DescriptionBlock[]): Group[] {
  const groups: Group[] = [];
  let autoFeatureIndex = 0;
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "divider") {
      groups.push({ kind: "divider" });
      i += 1;
    } else if (b.type === "feature") {
      const isAuto = !b.side || b.side === "auto";
      // auto → xen kẽ theo thứ tự xuất hiện; ép tay → theo side.
      const reverse = isAuto ? autoFeatureIndex % 2 === 1 : b.side === "right";
      if (isAuto) autoFeatureIndex += 1;
      groups.push({ kind: "feature", block: b, reverse });
      i += 1;
    } else if (b.type === "image" || b.type === "video") {
      groups.push({ kind: "media", media: b });
      i += 1;
    } else if (b.type === "suitability") {
      groups.push({ kind: "suitability", block: b });
      i += 1;
    } else if (b.type === "sizeGuide") {
      groups.push({ kind: "sizeGuide", block: b });
      i += 1;
    } else if (!FLOW_TYPES.has(b.type)) {
      // Loại không render trong mô tả (vd "prosCons" — đã có khối riêng): bỏ qua, KHÔNG tạo flow rỗng.
      i += 1;
    } else {
      // Một "mục" = (tiêu đề nếu có) + các đoạn/danh sách/ghi chú đi liền sau, dừng TRƯỚC tiêu đề kế.
      // Nhờ vậy mỗi tiêu đề mở một mục mới và được kẻ vạch chia → tránh dồn thành một cột chữ dài.
      const section: DescriptionBlock[] = [b];
      i += 1;
      while (i < blocks.length && NON_HEADING_TEXT.has(blocks[i].type)) {
        section.push(blocks[i]);
        i += 1;
      }
      groups.push({ kind: "flow", blocks: section });
    }
  }
  return groups;
}

function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function MediaBlock({ block }: { block: DescriptionBlock }) {
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
          <figcaption className="mt-2 text-caption italic text-muted-foreground">{block.caption}</figcaption>
        ) : null}
      </figure>
    );
  }
  if (block.type === "video") {
    const raw = block.url?.trim() || "";
    if (!raw) return null;
    const id = block.provider === "upload" ? null : youTubeId(raw);
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
          ) : (
            <video src={resolveMediaUrl(raw) || raw} controls className="absolute inset-0 h-full w-full bg-black" />
          )}
        </div>
        {block.caption ? (
          <figcaption className="mt-2 text-caption italic text-muted-foreground">{block.caption}</figcaption>
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
        <h3 className="font-heading text-h4 font-bold uppercase leading-tight text-foreground">{text}</h3>
      ) : (
        // Thanh nhấn đỏ DỌC bên trái, tự cao bằng cả khối tiêu đề (self-stretch) — cân đối với tiêu đề
        // dài nhiều dòng, không còn căn giữa lệch theo dòng đầu như trước.
        <h2 className="flex gap-3 font-heading text-h2 font-bold uppercase leading-tight text-foreground">
          <span className="w-1 shrink-0 self-stretch bg-brand" aria-hidden />
          <span>{text}</span>
        </h2>
      );
    }
    case "paragraph": {
      const html = block.html?.trim();
      if (!html) return null;
      return <div className="wyswyg text-body-lg" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }} />;
    }
    case "list": {
      const items = (block.items ?? []).map((it) => (it ?? "").trim()).filter(Boolean);
      if (items.length === 0) return null;
      if (block.style === "numbered") {
        return (
          <ol className="flex list-none flex-col gap-2 text-body-lg leading-snug">
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
        <ul className="flex list-none flex-col gap-2 text-body-lg leading-snug">
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
          <div className="wyswyg text-body-lg" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }} />
        </div>
      );
    }
    default:
      return null;
  }
}

function TextStack({ blocks }: { blocks: DescriptionBlock[] }) {
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
function FeatureBody({ block }: { block: FeatureBlockT }) {
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
            // text-ui-16 = 16px CỐ ĐỊNH (không dùng text-caption rem vì trang WP gốc 14px → co còn 12.25px).
            <p className="!mb-0 font-heading text-ui-16 font-bold uppercase tracking-[0.2em] text-brand">
              {subheading}
            </p>
          ) : null}
          {heading ? (
            // text-ui-24 = 24px CỐ ĐỊNH (text-h2 rem co còn 21px ở gốc 14px). Đồng bộ với mô tả 18px.
            <h2 className="flex gap-3 font-heading text-ui-24 font-bold uppercase leading-tight text-foreground">
              <span className="w-1 shrink-0 self-stretch bg-brand" aria-hidden />
              <span>{heading}</span>
            </h2>
          ) : null}
        </div>
      ) : null}
      {html ? <div className="wyswyg text-body-lg" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }} /> : null}
      {items.length > 0 ? (
        block.listStyle === "numbered" ? (
          <ol className="flex list-none flex-col gap-2 text-body-lg leading-snug">
            {items.map((it, idx) => (
              <li key={idx} className="flex gap-2.5 text-foreground">
                <span className="font-heading font-bold text-brand">{idx + 1}.</span>
                <span>{it}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="flex list-none flex-col gap-2 text-body-lg leading-snug">
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
    <h2 className="flex gap-3 font-heading text-h2 font-bold uppercase leading-tight text-foreground">
      <span className="w-1 shrink-0 self-stretch bg-brand" aria-hidden />
      <span>{t}</span>
    </h2>
  );
}

/** Khối "Phù hợp với ai" (V246) — danh sách thẻ tư vấn (đối tượng đậm → lời khuyên → link nội bộ). */
function SuitabilityBlockView({ block }: { block: SuitabilityBlockT }) {
  const cards = (block.cards ?? []).filter(
    (c) => (c.audience ?? "").trim() || (c.advice ?? "").trim(),
  );
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-5">
      <BlockTitle text={block.title} />
      <div className="flex flex-col gap-3">
        {cards.map((card, index) => {
          const audience = (card.audience ?? "").trim();
          const advice = (card.advice ?? "").trim();
          const linkLabel = (card.linkLabel ?? "").trim();
          const linkUrl = (card.linkUrl ?? "").trim();
          const hasLink = Boolean(linkLabel && linkUrl);
          return (
            <div
              key={index}
              className="border-l-4 border-l-brand bg-secondary px-4 py-3 text-18 leading-relaxed text-muted-foreground"
            >
              {audience && <strong className="font-bold text-foreground">{audience}</strong>}
              {audience && (advice || hasLink) && <span> → </span>}
              {advice && <span>{advice}</span>}
              {hasLink && (
                <>
                  {advice && " "}
                  <Link href={linkUrl} className="font-medium text-brand hover:underline">
                    {linkLabel}
                  </Link>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Khối "Bảng size" (V246) — HTML tự do (thường là bảng), sanitize trước khi render. */
function SizeGuideBlockView({ block }: { block: SizeGuideBlockT }) {
  const html = block.html ? sanitizeRichHtml(block.html) : "";
  if (!html) return null;
  return (
    <div className="flex flex-col gap-5">
      <BlockTitle text={block.title} />
      <div className="wyswyg text-body-lg" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/**
 * Render thuần một mảng khối ĐÃ resolve theo ngôn ngữ (không tự localize). Dùng cho tab tự do
 * (nội dung khối của tab đã được resolve server-side). Rỗng → không render gì.
 */
export function DescriptionBlocksView({ blocks }: { blocks: DescriptionBlock[] }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  // Mỗi khối mô tả tự cách đều nhau và ngăn cách bằng một đường kẻ mờ xám (border-default).
  // Divider admin chèn thủ công không cần render riêng nữa — nó chỉ còn nhiệm vụ ngắt cụm chữ
  // trong groupBlocks; phần kẻ/giãn cách giữa các khối giờ tự động và đồng đều.
  const groups = groupBlocks(blocks).filter(
    (g): g is Exclude<Group, { kind: "divider" }> => g.kind !== "divider",
  );
  return (
    <div className="pdp-desc-rich flex flex-col">
      {groups.map((g, idx) => (
        <section
          key={idx}
          // Khoảng cách giữa các khối: MỘT giá trị cố định cho MỌI breakpoint (không còn nhảy
          // 40px→56px ở desktop) và đối xứng đều hai bên đường kẻ chia → nhịp dọc bằng nhau,
          // không bị "khối thì sát khối thì hở" như khi mỗi breakpoint một con số.
          className={cn(idx === 0 && "mb-8", idx > 0 && "border-t border-t-border-default pt-8 pb-8")}
        >
          {g.kind === "flow" ? (
            <TextStack blocks={g.blocks} />
          ) : g.kind === "media" ? (
            <MediaBlock block={g.media} />
          ) : g.kind === "suitability" ? (
            <SuitabilityBlockView block={g.block} />
          ) : g.kind === "sizeGuide" ? (
            <SizeGuideBlockView block={g.block} />
          ) : (
            // feature: 2 cột ảnh–chữ, xen kẽ trái/phải (chỉ desktop; mobile xếp dọc).
            <div className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
              <div className={cn(g.reverse && "md:order-2")}>
                {g.block.url ? (
                  <figure className="m-0">
                    <img
                      src={resolveMediaUrl(g.block.url) || ""}
                      alt={g.block.alt || ""}
                      loading="lazy"
                      className="aspect-[4/3] w-full border border-border object-cover"
                    />
                    {g.block.caption ? (
                      <figcaption className="mt-2 text-caption italic text-muted-foreground">
                        {g.block.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                ) : null}
              </div>
              <div className={cn(g.reverse && "md:order-1")}>
                <FeatureBody block={g.block} />
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export function ProductDescriptionBlocks({
  blocks,
  fallback,
}: {
  /** Khối VI render sẵn ở server (giữ ISR/SEO). */
  blocks: DescriptionBlock[];
  /** Nội dung thay thế khi không có khối nào (mô tả HTML legacy — tự đổi ngôn ngữ). */
  fallback: ReactNode;
}) {
  // Đổi sang EN: lấy khối bản EN từ payload localized; rỗng → dùng khối VI (prop).
  const enBlocks = useLocalizedField<DescriptionBlock[]>("descriptionBlocks");
  const active = Array.isArray(enBlocks) && enBlocks.length > 0 ? enBlocks : blocks;

  if (!Array.isArray(active) || active.length === 0) {
    return <>{fallback}</>;
  }
  return <DescriptionBlocksView blocks={active} />;
}
