import DOMPurify from 'dompurify'

// Tags allowed in admin-managed HTML setting values (footer text, rich descriptions...).
const ALLOWED_TAGS = [
  'a', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'div', 'em',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i',
  'img', 'li', 'ol', 'p', 'pre', 'small', 'span', 'strong',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
]

const ALLOWED_ATTR = [
  'aria-label', 'class', 'id', 'title',
  'href', 'rel', 'target',
  'alt', 'src', 'width', 'height', 'loading',
  'colspan', 'rowspan', 'scope',
  // `style` cho phép admin tự chỉnh giao diện bằng CSS inline khi dán HTML (3 khối
  // Thông số kỹ thuật / Phù hợp với ai / Bảng size). DOMPurify vẫn chặn
  // script/onclick/javascript: và làm sạch nội dung CSS nguy hiểm.
  'style',
]

const INLINE_ALLOWED_TAGS = ['a', 'b', 'br', 'em', 'i', 's', 'span', 'strong', 'u']
const INLINE_ALLOWED_ATTR = ['class', 'href', 'rel', 'target', 'title', 'style']

/**
 * Sanitize an admin-managed HTML string before rendering via dangerouslySetInnerHTML.
 *
 * Setting values are written by admins, but a lower-privilege admin could store a
 * payload that runs in a higher-privilege admin's browser — so HTML settings must
 * still be sanitized (DOMPurify strips scripts, event handlers, javascript: URLs).
 *
 * @param {unknown} raw  Raw HTML string (or anything; non-strings are coerced).
 * @returns {string}     Sanitized HTML safe for dangerouslySetInnerHTML.
 */
export function sanitizeHtml(raw) {
  if (raw == null || raw === '') return ''
  const sanitized = DOMPurify.sanitize(String(raw), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
  return wrapTablesForScroll(sanitized)
}

/**
 * Làm sạch một mảnh HTML inline để đưa vào ô dữ liệu rich-text.
 * Khác với sanitizeHtml(), hàm này không bọc table bằng div vì caller đang nằm trong table/list.
 * Giữ strong/em và style/class hợp lệ để đổi ô khác không làm mất định dạng đang có.
 */
export function sanitizeInlineHtml(raw) {
  if (raw == null || raw === '') return ''
  return DOMPurify.sanitize(String(raw), {
    ALLOWED_TAGS: INLINE_ALLOWED_TAGS,
    ALLOWED_ATTR: INLINE_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}

// Bọc mỗi <table> bằng <div class="rich-table-scroll"> — khớp với cách bigbike-web
// render (lib/utils/html.ts). display:block đặt thẳng lên <table> phá vỡ table-layout
// (ô con vẫn table-cell nên trình duyệt tự sinh "bảng vô danh" bên trong để vẽ lưới,
// bảng vô danh đó không ăn width:100% của thẻ <table> ngoài) → bảng co theo nội dung
// thay vì chiếm hết chiều ngang. Ô xem trước ở đây phải khớp đúng hành vi thật của web.
function wrapTablesForScroll(html) {
  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (match) => `<div class="rich-table-scroll">${match}</div>`)
}
