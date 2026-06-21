import type { DescriptionBlock } from "@/lib/contracts/public";

export type FeatureBlockT = Extract<DescriptionBlock, { type: "feature" }>;
export type SuitabilityBlockT = Extract<DescriptionBlock, { type: "suitability" }>;
export type SizeGuideBlockT = Extract<DescriptionBlock, { type: "sizeGuide" }>;

/** Chữ KHÔNG phải tiêu đề — phần thân của một mục, gom liền sau tiêu đề cho tới tiêu đề kế tiếp. */
const NON_HEADING_TEXT = new Set(["paragraph", "list", "callout"]);

/** Các loại khối render được dưới dạng cụm CHỮ (flow): tiêu đề + thân. Loại NGOÀI tập này mà không phải
 *  feature/image/video/suitability/sizeGuide (vd "prosCons" — vốn render bằng khối RIÊNG ngoài mô tả) bị
 *  BỎ QUA, không tạo flow rỗng để khỏi sinh section trắng chỉ còn vạch kẻ + khoảng hở. */
const FLOW_TYPES = new Set(["heading", "paragraph", "list", "callout"]);

export type Group =
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
export function groupBlocks(blocks: DescriptionBlock[]): Group[] {
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
