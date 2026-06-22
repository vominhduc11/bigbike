import { generateId } from '@/lib/utils'

/**
 * Chuyển đổi giữa danh sách "Ô số liệu nổi bật" có cấu trúc (model nhập trong admin) và HTML lưu
 * vào `specStatsHtml` — web render HTML thay cho lưới có cấu trúc (V256). Model: [{ _key, value, unit, label }].
 *
 * Mỗi ô tối đa 3 dòng: `value` (số liệu chính — lớn/đậm/màu nhấn) · `unit` (đơn vị/chú thích — xám,
 * dòng GIỮA, TÙY CHỌN, bỏ trống thì ô chỉ còn 2 dòng) · `label` (tên chỉ tiêu — in hoa, xám nhạt).
 *
 * HTML sinh ra là một lưới tự chứa (inline-style + biến brand web `--color-brand`, kèm hex fallback)
 * mô phỏng FeaturedSpecsBar để giao diện mặc định không đổi. Container có class `bb-specstats` để
 * round-trip ổn định: parse/merge bám vào class này; sửa cấu trúc chỉ đổi chữ, giữ nguyên style.
 *
 * Mã hoá theo SỐ SPAN (không dùng data-attr để khỏi lệ thuộc bộ lọc HTML của web): 2 span =
 * [value, label] (không đơn vị — gồm cả HTML legacy V256 cũ) · 3 span = [value, unit, label].
 * `value` LUÔN là span đầu, `label` LUÔN là span cuối → giải mã không nhập nhằng.
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
    unit: (s?.unit || '').trim(),
    label: (s?.label || '').trim(),
  }
}
// Ô có nội dung khi có số liệu chính HOẶC tên chỉ tiêu (đơn vị đứng một mình không tạo ô).
const statHasContent = (s) => s.value || s.label

const GRID_STYLE =
  'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;' +
  'border:1px solid var(--color-border,#e5e7eb);background:var(--color-border,#e5e7eb)'
const BOX_STYLE =
  'display:flex;flex-direction:column;align-items:center;gap:4px;' +
  'background:var(--color-background,#ffffff);padding:24px 16px;text-align:center'
const VALUE_STYLE =
  'font-weight:700;font-size:24px;line-height:1;text-transform:uppercase;color:var(--color-brand,#e8281e)'
const UNIT_STYLE =
  'font-size:13px;font-weight:500;line-height:1.2;color:var(--color-muted-foreground,#6b7280)'
const LABEL_STYLE =
  'font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;' +
  'color:var(--color-muted-foreground,#6b7280);opacity:0.72'

/** 1 ô ({value,unit,label}) → markup các dòng (bỏ qua span đơn vị nếu trống). */
function boxHtml(s) {
  const parts = [`<span style="${VALUE_STYLE}">${escapeHtml(s.value)}</span>`]
  if (s.unit) parts.push(`<span style="${UNIT_STYLE}">${escapeHtml(s.unit)}</span>`)
  parts.push(`<span style="${LABEL_STYLE}">${escapeHtml(s.label)}</span>`)
  return `<div style="${BOX_STYLE}">${parts.join('')}</div>`
}

/** items[] ({value,unit,label}) → HTML lưới ô số liệu (rỗng nếu không ô nào có nội dung). */
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

/** Tách 1 ô thành {value,unit,label} theo số span: 3+ = value/unit/label, 2 = value/label, 1 = value. */
function readBox(box) {
  const spans = [...box.querySelectorAll('span, strong, b, p, div')]
  const text = (el) => (el?.textContent || '').trim()
  if (spans.length >= 3) return { value: text(spans[0]), unit: text(spans[1]), label: text(spans[2]) }
  if (spans.length === 2) return { value: text(spans[0]), unit: '', label: text(spans[1]) }
  if (spans.length === 1) return { value: text(spans[0]), unit: '', label: '' }
  // fallback: tách theo dòng text
  const lines = (box.textContent || '').split('\n').map((l) => l.trim()).filter(Boolean)
  return lines.length >= 3
    ? { value: lines[0] || '', unit: lines[1] || '', label: lines[2] || '' }
    : { value: lines[0] || '', unit: '', label: lines[1] || '' }
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

/** Đặt text {value,unit,label} vào 1 ô, GIỮ style span value & label sẵn có; chèn/cập nhật/gỡ dòng đơn vị. */
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
  // Dòng giữa = đơn vị (chèn mới / cập nhật / gỡ).
  const middle = spans.length >= 3 ? spans[1] : null
  if (s.unit) {
    if (middle) {
      middle.textContent = s.unit
    } else {
      const u = doc.createElement('span')
      u.setAttribute('style', UNIT_STYLE)
      u.textContent = s.unit
      box.insertBefore(u, labelSpan)
    }
  } else if (middle) {
    middle.remove()
  }
}

/**
 * Ghép model vào HTML hiện có mà CHỈ đổi text, GIỮ NGUYÊN style/markup span value & label. Ô thêm
 * mới nhân bản ô cuối (kế thừa CSS), bớt thì gỡ node; dòng đơn vị tự chèn/gỡ theo nội dung. HTML
 * trống / không tìm thấy container → sinh mặc định serializeSpecStats.
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
