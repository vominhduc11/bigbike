import { generateId } from '@/lib/utils'
import { hasHtmlInput, makeHtmlImportResult, textOf } from './htmlImport'

/**
 * Chuyển đổi giữa danh sách "Ô số liệu nổi bật" có cấu trúc (model nhập trong admin) và HTML lưu
 * vào `specStats` — web render HTML thay cho lưới có cấu trúc (V256). Model: [{ _key, value, label }].
 *
 * Mỗi ô 2 dòng: `value` (số liệu chính — lớn/đậm/màu nhấn) · `label` (tên chỉ tiêu — in hoa, xám nhạt).
 *
 * HTML sinh ra là một lưới tự chứa (inline-style dùng token canonical web `--bb-border-subtle`/
 * `--bb-bg-surface`/`--bb-text-a2-page`/`--bb-action-primary`/`--bb-text-a5-meta`/
 * `--bb-text-secondary`, kèm hex fallback cho các token không đổi theo breakpoint) mô phỏng
 * FeaturedSpecsBar để giao diện mặc định không đổi. Container có class `bb-specstats` để
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
  'border:1px solid var(--bb-border-subtle,#dddddd);background:var(--bb-border-subtle,#dddddd)'
const BOX_STYLE =
  'display:flex;flex-direction:column;align-items:center;gap:4px;' +
  'background:var(--bb-bg-surface,#ffffff);padding:24px 16px;text-align:center'
const VALUE_STYLE =
  'font-weight:700;font-size:var(--bb-text-a2-page);line-height:1;text-transform:uppercase;' +
  'color:var(--bb-action-primary,#cc0906)'
const LABEL_STYLE =
  'font-size:var(--bb-text-a5-meta);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;' +
  'color:var(--bb-text-secondary,#6f6f6f)'

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

function findStatBoxes(doc) {
  const marked = doc.querySelector('.bb-specstats')
  if (marked) return [...marked.children]
  const listItems = [...doc.querySelectorAll('li')]
  if (listItems.length) return listItems
  const direct = [...doc.body.children].filter((element) => textOf(element))
  if (direct.length > 1) return direct
  return direct
}

function isStatCandidate(box) {
  if (!box) return false
  if (box.children.length >= 2) return true
  if (box.querySelector('strong, b, span')) return true
  return /\n|[|:：→—–-]/.test(textOf(box))
}

function looksLikeStatValue(value) {
  return /\d|%|kg|gram|cm|mm|ece|dot|watt/i.test(value)
}

function headingStatPairs(doc) {
  return [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .map((heading) => {
      const label = heading.nextElementSibling
      if (!label || !textOf(heading) || !textOf(label)) return null
      const headingText = textOf(heading)
      const labelText = textOf(label)
      const headingIsValue = looksLikeStatValue(headingText) || !looksLikeStatValue(labelText)
      return {
        heading,
        label,
        headingIsValue,
        value: headingIsValue ? headingText : labelText,
        metric: headingIsValue ? labelText : headingText,
      }
    })
    .filter(Boolean)
}

/** Tách 1 ô thành {value,label}: value = span đầu, label = span cuối (bỏ qua span giữa nếu có). */
function readBox(box) {
  const spans = [...box.children].filter((element) => textOf(element))
  const text = (el) => (el?.textContent || '').trim()
  if (spans.length >= 2) return { value: text(spans[0]), label: text(spans.at(-1)) }
  const marker = box.querySelector('strong, b')
  if (marker) {
    const clone = box.cloneNode(true)
    clone.querySelectorAll('strong, b').forEach((element) => element.remove())
    const remainder = text(clone).replace(/^[|:：→—–-]+\s*/, '').trim()
    return { value: text(marker), label: remainder }
  }
  if (spans.length === 1) return { value: text(spans[0]), label: '' }
  // fallback: tách theo dòng text
  const lines = text(box).split(/\n|\s+[|→—–-]\s+/).map((l) => l.trim()).filter(Boolean)
  return { value: lines[0] || '', label: lines.at(-1) || '' }
}

/** Detailed tolerant parser used by the safe HTML import flow. */
export function parseSpecStatsResult(html) {
  if (!hasHtmlInput(html) || typeof DOMParser === 'undefined') {
    return makeHtmlImportResult({ hasInput: hasHtmlInput(html) })
  }
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const headingPairs = headingStatPairs(doc)
    if (headingPairs.length) {
      const items = headingPairs.map(({ value, metric }) => ({ _key: generateId(), value, label: metric }))
      return makeHtmlImportResult({ items, hasInput: true })
    }
    const boxes = findStatBoxes(doc)
    const items = boxes
      .filter(isStatCandidate)
      .map((box) => ({ _key: generateId(), ...readBox(box) }))
      .filter(statHasContent)
    return makeHtmlImportResult({ items, skippedCount: boxes.length - items.length + (items.length ? 0 : 1), hasInput: true })
  } catch {
    return makeHtmlImportResult({ skippedCount: 1, hasInput: true })
  }
}

/** HTML → items[] (best-effort; giữ API cũ cho caller hiện có). */
export function parseSpecStatsFromHtml(html) {
  return parseSpecStatsResult(html).items
}

/** Đặt text {value,label} vào 1 ô, GIỮ style span value & label sẵn có; gỡ span giữa nếu còn sót. */
function applyStatToBox(doc, box, s) {
  let spans = [...box.children]
  const directTextNodes = [...box.childNodes].filter((node) => node.nodeType === 3 && node.textContent.trim())
  if (spans.length === 0) {
    box.textContent = s.label ? `${s.value} — ${s.label}` : s.value
    return
  }
  directTextNodes.forEach((node) => node.remove())
  // Đảm bảo có span value (đầu) + span label (cuối).
  if (spans.length === 1) {
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
    const headingPairs = headingStatPairs(doc)
    const stats = (items || []).map(normalizeStat).filter(statHasContent)
    if (headingPairs.length && headingPairs.length === stats.length) {
      stats.forEach((stat, index) => {
        const pair = headingPairs[index]
        if (pair.headingIsValue) {
          pair.heading.textContent = stat.value
          pair.label.textContent = stat.label
        } else {
          pair.heading.textContent = stat.label
          pair.label.textContent = stat.value
        }
      })
      return doc.body.innerHTML
    }
    const initialBoxes = findStatBoxes(doc).filter(isStatCandidate)
    const container = initialBoxes[0]?.parentElement
    if (!container || !initialBoxes.length) return fresh

    if (stats.length === 0) {
      if (container.matches('.bb-specstats, ul')) container.remove()
      else initialBoxes.forEach((box) => box.remove())
      return doc.body.innerHTML.trim() ? doc.body.innerHTML : ''
    }

    let boxes = initialBoxes
    while (boxes.length < stats.length) {
      const clone = boxes[boxes.length - 1].cloneNode(true)
      container.appendChild(clone)
      boxes = [...boxes, clone]
    }
    while (boxes.length > stats.length) {
      boxes[boxes.length - 1].remove()
      boxes = boxes.slice(0, -1)
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
