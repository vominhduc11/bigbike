// Slugify dùng chung cho gợi ý đường dẫn (bỏ dấu tiếng Việt → kebab-case).
// Dùng cho Danh mục / Thương hiệu / Bài viết (cùng thuật toán).
//
// LƯU Ý: Sản phẩm dùng `slugify` riêng trong `product-detail/constants.js`
// (giữ hyphen sẵn có, thứ tự xử lý khác) → KHÔNG gộp vào đây để tránh đổi slug
// sản phẩm đã sinh. Xem báo cáo mục "cần backend".
export function toSlug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
