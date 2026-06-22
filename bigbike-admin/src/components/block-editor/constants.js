// Block-type vocabulary + factory for BlockEditor.
// Extracted from BlockEditor.jsx so the screen file stays component-only
// (pure constants/helpers live here to keep fast-refresh happy).
import { generateId } from '@/lib/utils'

export const BLOCK_TYPES = ['feature', 'heading', 'paragraph', 'list', 'image', 'video', 'callout', 'divider']

// Vốn từ khối đầy đủ — dùng cho Content (bài viết/trang). Mỗi mục: nhãn i18n + type (+ preset).
export const CONTENT_MENU = BLOCK_TYPES.map((type) => ({
  type,
  labelKey: `products.detail.blocks.blockType${type.charAt(0).toUpperCase()}${type.slice(1)}`,
}))

// Vốn từ cho SẢN PHẨM (V238): chỉ các khối mô tả/tính năng cơ bản. "Phù hợp với ai" và "Bảng size"
// KHÔNG còn là khối thêm trong mô tả — tách RA thành 2 card nhập RIÊNG (giống "Ưu điểm & Nhược điểm").
// Dữ liệu vẫn lưu dạng khối suitability/sizeGuide trong descriptionBlocks; web render thành khối cố
// định #6/#7 (xem PDP_CONTENT_GUIDE §0b). Ưu/Nhược điểm nhập ở card riêng, lưu vào product_highlights.
export const PRODUCT_MENU = [
  { type: 'paragraph',   labelKey: 'products.detail.blocks.blockTypeText' },
  { type: 'image',       labelKey: 'products.detail.blocks.blockTypeImage' },
  { type: 'feature',     labelKey: 'products.detail.blocks.blockTypeFeatureRight', preset: { side: 'right' } },
  { type: 'feature',     labelKey: 'products.detail.blocks.blockTypeFeatureLeft',  preset: { side: 'left' } },
]

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
    case 'feature':   block = { ...base, side: 'auto', url: '', alt: '', caption: '', subheading: '', heading: '', html: '', listStyle: 'bulleted', items: [''] }; break
    case 'suitability': block = { ...base, title: '', cards: [{ audience: '', advice: '', linkLabel: '', linkUrl: '' }], html: '' }; break
    case 'sizeGuide':   block = { ...base, title: '', html: '' }; break
    case 'divider':   block = base; break
    default:          block = base; break
  }
  return preset ? { ...block, ...preset } : block
}
