import { generateId } from '@/lib/utils'

/**
 * Chuyển đổi giữa danh sách "Ô số liệu nổi bật" có cấu trúc (model nhập trong admin) và HTML lưu
 * vào `specStatsHtml` — web render HTML thay cho lưới có cấu trúc (V256). Model: [{ _key, value, label }].
 *
 * Mỗi ô 2 dòng: `value` (số liệu chính — lớn/đậm/màu nhấn) · `label` (tên chỉ tiêu — in hoa, xám nhạt).
 *
 * HTML sinh ra là một lưới tự chứa (inline-style + biến brand web `--color-brand`, kèm hex fallback)
 * mô phỏng FeaturedSpecsBar để giao diện mặc định không đổi. Container có class `bb-specstats` để
 * round-trip ổn định: parse/merge bám vào class này; sửa cấu trúc chỉ đổi chữ, giữ nguyên style.
 *
 * Mã hoá theo SỐ SPAN (không dùng data-attr để khỏi lệ thuộc bộ lọc HTML của web): 2 span =
 * [value, label]. `value` LUÔN là span đầu, `label` LUÔN là span cuối → giải mã không nhập nhằng
 * kể cả với dữ liệu cũ còn sót span đơn vị ở giữa (bỏ qua an toàn, không cần chờ migration chạy).
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeStat(s) {
  return {
    value: (s?.value || '').trim(),
    label: (s?.label || '').trim(),
  }
}
// Ô có nội dung khi có số liệu chính HOẶC tên chỉ tiêu.
const statHasContent = (s) => s.value || s.label

const GRID_STYLE =
  'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;' +
  'border:1px solid var(--color-border,#e5e7eb);background:var(--color-border,#e5e7eb)'
const BOX_STYLE =
  'display:flex;flex-direction:column;align-items:center;gap:4px;' +
  'background:var(--color-background,#ffffff);padding:24px 16px;text-align:center'
const VALUE_STYLE =
  'font-weight:700;font-size:24px;line-height:1;text-transform:uppercase;color:var(--color-brand,#e8281e)'
const LABEL_STYLE =
  'font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;' +
  'color:var(--color-muted-foreground,#6b7280);opacity:0.72'

/** 1 ô ({value,label}) → markup 2 dòng. */
function boxHtml(s) {
  const parts = [
    `<span style="${VALUE_STYLE}">${escapeHtml(s.value)}</span>`,
    `<span style="${LABEL_STYLE}">${escapeHtml(s.label)}</span>`,
  ]
  return `<div style="${BOX_STYLE}">${parts.join('')}</div>`
}

/** items[] ({value,label}) → HTML lưới ô số liệu (rỗng nếu không ô nào có nội dung). */
export function serializeSpecStats(items) {
  const stats = (items || []).map(normalizeStat).filter(statHasContent)
  if (stats.length === 0) return ''
  return `<div class="bb-specstats" style="${GRID_STYLE}">${stats.map(boxHtml).join('')}</div>`
}

/** Container lưới: ưu tiên .bb-specstats; nếu không có thì lấy phần tử bọc đầu có con là phần tử. */
function findContainer(doc) {
  const marked = doc.querySelector('.bb-specstats')
  if (marked) return marked
  const first = doc.body.firstElementChild
  if (first && first.children.length > 0) return first
  return null
}

/** Tách 1 ô thành {value,label}: value = span đầu, label = span cuối (bỏ qua span giữa nếu có). */
function readBox(box) {
  const spans = [...box.querySelectorAll('span, strong, b, p, div')]
  const text = (el) => (el?.textContent || '').trim()
  if (spans.length >= 2) return { value: text(spans[0]), label: text(spans.at(-1)) }
  if (spans.length === 1) return { value: text(spans[0]), label: '' }
  // fallback: tách theo dòng text
  const lines = (box.textContent || '').split('\n').map((l) => l.trim()).filter(Boolean)
  return { value: lines[0] || '', label: lines.at(-1) || '' }
}

/** HTML → items[] (best-effort). */
export function parseSpecStatsFromHtml(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return []
  if (typeof DOMParser === 'undefined') return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const container = findContainer(doc)
    if (!container) return []
    return [...container.children]
      .map((box) => ({ _key: generateId(), ...readBox(box) }))
      .filter(statHasContent)
  } catch {
    return []
  }
}

/** Đặt text {value,label} vào 1 ô, GIỮ style span value & label sẵn có; gỡ span giữa nếu còn sót. */
function applyStatToBox(doc, box, s) {
  let spans = [...box.children]
  // Đảm bảo có span value (đầu) + span label (cuối).
  if (spans.length === 0) {
    const v = doc.createElement('span'); v.setAttribute('style', VALUE_STYLE); box.appendChild(v)
    const l = doc.createElement('span'); l.setAttribute('style', LABEL_STYLE); box.appendChild(l)
    spans = [...box.children]
  } else if (spans.length === 1) {
    const l = doc.createElement('span'); l.setAttribute('style', LABEL_STYLE); box.appendChild(l)
    spans = [...box.children]
  }
  const valueSpan = spans[0]
  const labelSpan = spans[spans.length - 1]
  valueSpan.textContent = s.value
  labelSpan.textContent = s.label
  // Gỡ mọi span còn sót ở giữa (dữ liệu cũ có dòng đơn vị chưa migrate).
  spans.slice(1, -1).forEach((el) => el.remove())
}

/**
 * Ghép model vào HTML hiện có mà CHỈ đổi text, GIỮ NGUYÊN style/markup span value & label. Ô thêm
 * mới nhân bản ô cuối (kế thừa CSS), bớt thì gỡ node. HTML trống / không tìm thấy container → sinh
 * mặc định serializeSpecStats.
 */
export function mergeSpecStatsIntoHtml(items, existingHtml) {
  const fresh = serializeSpecStats(items)
  if (!existingHtml || typeof existingHtml !== 'string' || !existingHtml.trim()) return fresh
  if (typeof DOMParser === 'undefined') return fresh
  try {
    const doc = new DOMParser().parseFromString(existingHtml, 'text/html')
    const container = findContainer(doc)
    if (!container) return fresh

    const stats = (items || []).map(normalizeStat).filter(statHasContent)
    if (stats.length === 0) {
      container.remove()
      return doc.body.innerHTML.trim() ? doc.body.innerHTML : ''
    }

    let boxes = [...container.children]
    if (boxes.length === 0) return fresh
    while (boxes.length < stats.length) {
      container.appendChild(boxes[boxes.length - 1].cloneNode(true))
      boxes = [...container.children]
    }
    while (boxes.length > stats.length) {
      boxes[boxes.length - 1].remove()
      boxes = [...container.children]
    }
    stats.forEach((s, i) => {
      const box = boxes[i]
      if (box) applyStatToBox(doc, box, s)
    })
    return doc.body.innerHTML
  } catch {
    return fresh
  }
}
