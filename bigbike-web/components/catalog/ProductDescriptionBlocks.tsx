"use client";

import type { ReactNode } from "react";

import { useLocale } from "next-intl";
import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import type { DescriptionBlock, SizeGuideSection, SuitabilitySection } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { groupBlocks, featureHasText, featureHasImage, type Group } from "./description-blocks/grouping";
import {
  FeatureBody,
  MediaBlock,
  SizeGuideBlockView,
  SuitabilityBlockView,
  TextStack,
} from "./description-blocks/blocks";

/**
 * Hiển thị phần mô tả sản phẩm TỪ các khối có cấu trúc (admin dựng bằng BlockEditor) theo phong cách
 * mockup PDP — nhưng dùng màu/font của design system web (token brand, font-heading), KHÔNG hardcode.
 *
 * Bố cục cố định, dễ đoán cho admin:
 *  • Khối `feature` (ảnh + tiêu đề + đoạn + danh sách trong MỘT khối) → một "hàng tính năng" 2 cột
 *    ảnh–chữ, xen kẽ trái/phải khi `side`="auto"/null (giống mockup); "left"/"right" ép vị trí ảnh.
 *  • Cụm chữ rộng hết khổ, NGẮT THÀNH TỪNG MỤC: một tiêu đề + các đoạn/danh sách/ghi chú đi liền sau nó
 *    = một mục; còn mỗi đoạn/danh sách/ghi chú đứng độc lập (không có tiêu đề) là một mục RIÊNG (xem
 *    groupBlocks). Mỗi mục được kẻ vạch chia → 2 khối Văn bản cạnh nhau vẫn tách bạch, không dính liền.
 *  • Ảnh/Video đứng một mình → khung ảnh rộng hết khổ.
 *
 * Bộ render từng khối nằm ở description-blocks/blocks; logic gom nhóm ở description-blocks/grouping.
 * Đổi ngôn ngữ: bản EN lấy qua `useLocalizedField("descriptionBlocks")` (client refetch, giữ ISR/SEO);
 * khi không có khối nào (sản phẩm legacy chỉ có HTML) → render `fallback` (tab mô tả HTML cũ).
 */

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
    (g): g is Exclude<Group, { kind: "divider" }> =>
      g.kind !== "divider" &&
      !(g.kind === "feature" && !featureHasText(g.block) && !featureHasImage(g.block)),
  );
  return (
    <div className="pdp-desc-rich flex flex-col">
      {groups.map((g, idx) => (
        <section
          key={idx}
          // Khoảng cách giữa các khối: đối xứng đều hai bên đường kẻ chia → nhịp dọc bằng nhau,
          // không bị "khối thì sát khối thì hở". Mobile 24px (màn hẹp, gọn hơn), desktop 32px
          // (thoáng hơn cho khổ rộng) — chỉ đổi ĐÚNG con số này theo breakpoint, vẫn một giá trị
          // duy nhất mỗi bên đường kẻ nên nhịp không bị giật.
          className={cn(
            idx === 0 && "mb-6 md:mb-8",
            idx > 0 && "border-t border-t-border-default pt-6 pb-6 md:pt-8 md:pb-8",
          )}
        >
          {g.kind === "flow" ? (
            <TextStack blocks={g.blocks} />
          ) : g.kind === "media" ? (
            <MediaBlock block={g.media} />
          ) : featureHasText(g.block) && featureHasImage(g.block) ? (
            // Đủ ảnh + chữ → 2 cột so le trái/phải (chỉ desktop; mobile xếp dọc).
            <div className="grid items-center gap-6 md:grid-cols-2 md:gap-9">
              <div className={cn("max-md:order-2", g.reverse && "md:order-2")}>
                <figure className="m-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveMediaUrl(g.block.url) || ""}
                    alt={g.block.alt || ""}
                    loading="lazy"
                    className="aspect-[4/3] w-full border border-border object-cover"
                  />
                  {g.block.caption ? (
                    <figcaption className="mt-2 text-ui-14 max-md:text-ui-12 italic text-muted-foreground">
                      {g.block.caption}
                    </figcaption>
                  ) : null}
                </figure>
              </div>
              <div className={cn("max-md:order-1", g.reverse && "md:order-1")}>
                <FeatureBody block={g.block} />
              </div>
            </div>
          ) : featureHasText(g.block) ? (
            // Chỉ có chữ → full width, không chừa nửa cột trống.
            <FeatureBody block={g.block} />
          ) : (
            // Chỉ có ảnh → full width.
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveMediaUrl(g.block.url) || ""}
                alt={g.block.alt || ""}
                loading="lazy"
                className="aspect-[4/3] w-full border border-border object-cover"
              />
              {g.block.caption ? (
                <figcaption className="mt-2 text-ui-14 max-md:text-ui-12 italic text-muted-foreground">
                  {g.block.caption}
                </figcaption>
              ) : null}
            </figure>
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
  // Đổi sang EN: lấy khối bản EN từ payload localized; rỗng → dùng khối VI (prop). Từ V327/V328,
  // suitability/sizeGuide không còn nằm trong descriptionBlocks nữa (field riêng, xem
  // ProductSuitabilitySection/ProductSizeGuideSection bên dưới) — không cần lọc lại ở đây.
  const enBlocks = useLocalizedField<DescriptionBlock[]>("descriptionBlocks");
  const locale = useLocale();
  const active = locale === "en" ? enBlocks : blocks;

  if (!Array.isArray(active) || active.length === 0) {
    return <>{fallback}</>;
  }
  return <DescriptionBlocksView blocks={active} />;
}

/**
 * Khối "Phù hợp với ai" (#7) và "Bảng size" (#8) — SECTION RIÊNG ở vị trí cố định theo canonical
 * layout (PDP_CONTENT_GUIDE §0b), field riêng trên `Product` (không còn nằm trong descriptionBlocks
 * từ V327/V328). Dùng chung bộ render khối (Suitability/SizeGuideBlockView) và cùng cơ chế đổi ngôn
 * ngữ: bản EN lấy qua `useLocalizedField` trực tiếp trên field mới; chưa có EN (server/SSR) → dùng
 * section VI (prop) → giữ nội dung trong HTML cho SEO.
 */
export function ProductSuitabilitySection({ section }: { section: SuitabilitySection | null }) {
  const enSection = useLocalizedField<SuitabilitySection>("suitabilitySection");
  const locale = useLocale();
  const active = locale === "en" ? enSection : section;
  if (!active) return null;
  return (
    <div className="pdp-desc-rich flex flex-col gap-8">
      <SuitabilityBlockView block={active} />
    </div>
  );
}

export function ProductSizeGuideSection({ section }: { section: SizeGuideSection | null }) {
  const enSection = useLocalizedField<SizeGuideSection>("sizeGuideSection");
  const locale = useLocale();
  const active = locale === "en" ? enSection : section;
  if (!active) return null;
  return (
    <div className="pdp-desc-rich flex flex-col gap-8">
      <SizeGuideBlockView block={active} />
    </div>
  );
}
