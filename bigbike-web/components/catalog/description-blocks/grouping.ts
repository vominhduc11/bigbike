import type { DescriptionBlock } from "@/lib/contracts/public";

export type FeatureBlockT = Extract<DescriptionBlock, { type: "feature" }>;

/** Trả về true nếu khối feature có phần chữ (subheading, heading, html, hoặc ít nhất một mục danh sách không rỗng). */
export function featureHasText(block: FeatureBlockT): boolean {
  if (block.subheading?.trim()) return true;
  if (block.heading?.trim()) return true;
  if (block.html?.trim()) return true;
  if ((block.items ?? []).some((it) => (it ?? "").trim())) return true;
  return false;
}

/** Trả về true nếu khối feature có ảnh (url không rỗng). */
export function featureHasImage(block: FeatureBlockT): boolean {
  return Boolean(block.url?.trim());
}

/** Chữ KHÔNG phải tiêu đề — phần thân của một mục, gom liền sau tiêu đề cho tới tiêu đề kế tiếp. */
const NON_HEADING_TEXT = new Set(["paragraph", "list", "callout"]);

/** Các loại khối render được dưới dạng cụm CHỮ (flow): tiêu đề + thân. Loại NGOÀI tập này mà không phải
 *  feature/image/video (vd "prosCons" — vốn render bằng khối RIÊNG ngoài mô tả) bị BỎ QUA, không tạo
 *  flow rỗng để khỏi sinh section trắng chỉ còn vạch kẻ + khoảng hở. suitability/sizeGuide không còn
 *  xuất hiện ở đây từ V327/V328 — tách thành field riêng trên Product, không phải khối trong mảng này. */
const FLOW_TYPES = new Set(["heading", "paragraph", "list", "callout"]);

export type Group =
  | { kind: "feature"; block: FeatureBlockT; reverse: boolean }
  | { kind: "media"; media: DescriptionBlock }
  | { kind: "flow"; blocks: DescriptionBlock[] }
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
    } else if (!FLOW_TYPES.has(b.type)) {
      // Loại không render trong mô tả (vd "prosCons" — đã có khối riêng): bỏ qua, KHÔNG tạo flow rỗng.
      i += 1;
    } else if (b.type === "heading") {
      // Mục mở đầu bằng TIÊU ĐỀ = tiêu đề + các đoạn/danh sách/ghi chú đi liền sau (phần thân của nó),
      // dừng TRƯỚC tiêu đề kế. Tiêu đề và nội dung của nó thuộc cùng một mục, không bị vạch chia cắt rời.
      const section: DescriptionBlock[] = [b];
      i += 1;
      while (i < blocks.length && NON_HEADING_TEXT.has(blocks[i].type)) {
        section.push(blocks[i]);
        i += 1;
      }
      groups.push({ kind: "flow", blocks: section });
    } else {
      // Đoạn văn / danh sách / ghi chú đứng ĐỘC LẬP (không nằm dưới một tiêu đề) → MỖI khối là một mục
      // riêng. Nhờ vậy 2 khối Văn bản cạnh nhau (mô tả sản phẩm không có tiêu đề/divider) vẫn được kẻ
      // vạch tách bạch như các khối Bảng size / Tính năng, thay vì dồn dính liền thành một cột chữ.
      groups.push({ kind: "flow", blocks: [b] });
      i += 1;
    }
  }
  return groups;
}
