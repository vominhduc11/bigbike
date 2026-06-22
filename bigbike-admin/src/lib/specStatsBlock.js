import { generateId } from '@/lib/utils'

/**
 * Chuyển đổi giữa danh sách "Ô số liệu nổi bật" có cấu trúc (model nhập trong admin) và HTML lưu
 * vào `specStatsHtml` — web render HTML thay cho lưới có cấu trúc (V256). Model: [{ _key, value, label }].
 *
 * HTML sinh ra là một lưới tự chứa (inline-style + biến brand web `--color-brand`, kèm hex fallback)
 * mô phỏng FeaturedSpecsBar để giao diện mặc định không đổi. Container có class `bb-specstats` để
 * round-trip ổn định: parse/merge bám vào class này; sửa cấu trúc chỉ đổi chữ, giữ nguyên style.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeStat(s) {
  return { value: (s?.value || '').trim(), label: (s?.label || '').trim() }
}
const statHasContent = (s) => s.value || s.label

const GRID_STYLE =
  'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;' +
  'border:1px solid var(--color-border,#e5e7eb);background:var(--color-border,#e5e7eb)'
const BOX_STYLE =
  'display:flex;flex-direction:column;align-items:center;gap:6px;' +
  'background:var(--color-background,#ffffff);padding:24px 16px;text-align:center'
const VALUE_STYLE =
  'font-weight:700;font-size:24px;line-height:1;text-transform:uppercase;color:var(--color-brand,#e8281e)'
const LABEL_STYLE =
  'font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-muted-foreground,#6b7280)'

/** items[] ({value,label}) → HTML lưới ô số liệu (rỗng nếu không ô nào có nội dung). */
export function serializeSpecStats(items) {
  const stats = (items || []).map(normalizeStat).filter(statHasContent)
  if (stats.length === 0) return ''
  const boxes = stats
    .map(
      (s) =>
        `<div style="${BOX_STYLE}">` +
        `<span style="${VALUE_STYLE}">${escapeHtml(s.value)}</span>` +
        `<span style="${LABEL_STYLE}">${escapeHtml(s.label)}</span>` +
        `</div>`,
    )
    .join('')
  return `<div class="bb-specstats" style="${GRID_STYLE}">${boxes}</div>`
}

/** Container lưới: ưu tiên .bb-specstats; nếu không có thì lấy phần tử bọc đầu có con là phần tử. */
function findContainer(doc) {
  const marked = doc.querySelector('.bb-specstats')
  if (marked) return marked
  const first = doc.body.firstElementChild
  if (first && first.children.length > 0) return first
  return null
}

/** HTML → items[] (best-effort). Mỗi ô: span đầu = value, span sau = label (fallback theo text). */
export function parseSpecStatsFromHtml(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return []
  if (typeof DOMParser === 'undefined') return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const container = findContainer(doc)
    if (!container) return []
    return [...container.children]
      .map((box) => {
        const spans = [...box.querySelectorAll('span, strong, b, p, div')]
        const value = (spans[0]?.textContent || '').trim()
        const label = (spans[1]?.textContent || '').trim()
        if (value || label) return { _key: generateId(), value, label }
        // fallback: tách 2 dòng text
        const lines = (box.textContent || '').split('\n').map((l) => l.trim()).filter(Boolean)
        return { _key: generateId(), value: lines[0] || '', label: lines[1] || '' }
      })
      .filter(statHasContent)
  } catch {
    return []
  }
}

/**
 * Ghép model vào HTML hiện có mà CHỈ đổi text, GIỮ NGUYÊN style/markup. Ô thêm mới nhân bản ô cuối
 * (kế thừa CSS), bớt thì gỡ node. HTML trống / không tìm thấy container → sinh mặc định serializeSpecStats.
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
      const clone = boxes[boxes.length - 1].cloneNode(true)
      container.appendChild(clone)
      boxes = [...container.children]
    }
    while (boxes.length > stats.length) {
      boxes[boxes.length - 1].remove()
      boxes = [...container.children]
    }
    stats.forEach((s, i) => {
      const box = boxes[i]
      if (!box) return
      let spans = [...box.querySelectorAll('span, strong, b, p, div')]
      while (spans.length < 2) {
        box.appendChild(doc.createElement('span'))
        spans = [...box.querySelectorAll('span, strong, b, p, div')]
      }
      spans[0].textContent = s.value
      spans[1].textContent = s.label
    })
    return doc.body.innerHTML
  } catch {
    return fresh
  }
}
