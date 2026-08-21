// Block-type vocabulary + factory for BlockEditor.
// Extracted from BlockEditor.jsx so the screen file stays component-only
// (pure constants/helpers live here to keep fast-refresh happy).
import { generateId } from '@/lib/utils'

// Vốn từ khối cho Content (bài viết Tin tức). Video block dùng bốn nguồn hợp lệ
// theo MEDIA_RULE_004; renderer vẫn đọc được dữ liệu legacy.
export const CONTENT_MENU = ['heading', 'paragraph', 'list', 'image', 'video'].map((type) => ({
  type,
  labelKey: `products.detail.blocks.blockType${type.charAt(0).toUpperCase()}${type.slice(1)}`,
}))

// Vốn từ cho SẢN PHẨM (V238, thu hẹp 2026-07-20): chỉ còn khối so le ảnh+chữ. "Phù hợp với ai" và
// "Bảng size" KHÔNG còn là khối thêm trong mô tả — tách RA thành 2 card nhập RIÊNG (giống "Ưu điểm &
// Nhược điểm"). (V327/V328) Dữ liệu của 2 card đó giờ lưu ở 2 field riêng form.suitabilitySection/
// sizeGuideSection, không còn embedded trong descriptionBlocks. Ưu/Nhược điểm nhập ở card riêng, lưu
// vào product_highlights. Owner decision 2026-07-20: bỏ hẳn 'paragraph'/'image' khỏi menu sản phẩm —
// chỉ giữ khối feature (ảnh phải + chữ trái / ảnh trái + chữ phải), đủ để làm chữ-thuần hoặc ảnh-thuần.
export const PRODUCT_MENU = [
  { type: 'feature',     labelKey: 'products.detail.blocks.blockTypeFeatureRight', preset: { side: 'right' } },
  { type: 'feature',     labelKey: 'products.detail.blocks.blockTypeFeatureLeft',  preset: { side: 'left' } },
]

// Sản phẩm không lưu side="auto" (owner decision 2026-07-20 — xem DATA_CONTRACT.md), nhưng thao tác
// Thêm/Chèn khối vẫn tự gợi ý phía ngược khối liền trước để ra so le mà không cần chọn tay (yêu cầu
// chủ shop 2026-07-21). Giá trị lưu vẫn tường minh 'left'/'right', không đổi contract nhập/xuất.
export function nextProductFeatureSide(prevSide) {
  return prevSide === 'right' ? 'left' : 'right'
}

// suitability/sizeGuide (V327/V328): không còn discriminator `type` — mỗi field là 1 object đơn,
// không phải phần tử mảng đa hình. `createBlock` vẫn dùng làm factory giá trị rỗng mặc định cho
// form.suitabilitySection/sizeGuideSection (giữ `_key` để editor không reseed giữa các lần render).
export function createBlock(type, preset) {
  const base = { _key: generateId(), type }
  let block
  switch (type) {
    case 'heading':   block = { ...base, level: 2, text: '' }; break
    case 'paragraph': block = { ...base, html: '' }; break
    case 'list':      block = { ...base, style: 'bulleted', items: [''] }; break
    case 'image':     block = { ...base, url: '', alt: '', caption: '' }; break
    case 'video':     block = { ...base, provider: 'youtube', url: '', caption: '' }; break
    case 'callout':   block = { ...base, variant: 'info', html: '' }; break
    case 'feature':   block = { ...base, side: 'auto', url: '', alt: '', caption: '', subheading: '', heading: '', html: '' }; break
    case 'suitability': block = { _key: base._key, title: '', cards: [{ audience: '', advice: '' }], html: '' }; break
    case 'sizeGuide':   block = { _key: base._key, title: '', html: '' }; break
    case 'divider':   block = base; break
    default:          block = base; break
  }
  return preset ? { ...block, ...preset } : block
}
