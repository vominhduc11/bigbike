import { generateId } from '@/lib/utils'

/**
 * Chuyển đổi giữa danh sách "Dải tin cậy" có cấu trúc (model nhập trong admin) và HTML lưu vào
 * `trustBadges` — web render HTML thay cho dải có cấu trúc (V257). Model: [{ _key, content }].
 *
 * HTML sinh ra là một dải flex tự chứa (inline-style + biến brand web `--color-brand`, kèm hex
 * fallback) mô phỏng dải tin cậy trên tên sản phẩm. Container có class `bb-trust-badges` để
 * round-trip ổn định; sửa cấu trúc chỉ đổi chữ, giữ nguyên style/markup (gồm chấm tròn).
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const contentOf = (b) => (b?.content || '').trim()

const ROW_STYLE =
  'display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;' +
  'font-size:14px;color:var(--color-muted-foreground,#6b7280)'
const BADGE_STYLE = 'display:flex;align-items:center;gap:8px'
const DOT_STYLE = 'height:6px;width:6px;flex:none;background:var(--color-brand,#e8281e)'

/** items[] ({content}) → HTML dải tin cậy (rỗng nếu không mục nào có nội dung). */
export function serializeTrustBadges(items) {
  const contents = (items || []).map(contentOf).filter(Boolean)
  if (contents.length === 0) return ''
  const spans = contents
    .map(
      (c) =>
        `<span style="${BADGE_STYLE}">` +
        `<span style="${DOT_STYLE}"></span>` +
        `<span>${escapeHtml(c)}</span>` +
        `</span>`,
    )
    .join('')
  return `<div class="bb-trust-badges" style="${ROW_STYLE}">${spans}</div>`
}

/** Container dải: ưu tiên .bb-trust-badges; nếu không có thì lấy phần tử bọc đầu có con là phần tử. */
function findContainer(doc) {
  const marked = doc.querySelector('.bb-trust-badges')
  if (marked) return marked
  const first = doc.body.firstElementChild
  if (first && first.children.length > 0) return first
  return null
}

/** Lấy phần chữ của một badge = text span cuối (bỏ chấm tròn rỗng); fallback textContent cả badge. */
function badgeText(el) {
  const spans = [...el.querySelectorAll('span')].filter((s) => (s.textContent || '').trim())
  if (spans.length) return (spans[spans.length - 1].textContent || '').trim()
  return (el.textContent || '').trim()
}

/** HTML → items[] (best-effort). */
export function parseTrustBadgesFromHtml(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return []
  if (typeof DOMParser === 'undefined') return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const container = findContainer(doc)
    if (!container) return []
    return [...container.children]
      .map((el) => ({ _key: generateId(), content: badgeText(el) }))
      .filter((b) => b.content)
  } catch {
    return []
  }
}

/** Đặt phần chữ cho 1 badge mà giữ nguyên chấm tròn/markup: ghi vào span text cuối (tạo nếu thiếu). */
function setBadgeText(doc, el, content) {
  const textSpans = [...el.querySelectorAll('span')]
  // span "chữ" = span KHÔNG phải chấm (không có style dot). Ưu tiên span cuối.
  const target = textSpans.length ? textSpans[textSpans.length - 1] : null
  if (target && target.children.length === 0) {
    target.textContent = content
  } else {
    const span = doc.createElement('span')
    span.textContent = content
    el.appendChild(span)
  }
}

/**
 * Ghép model vào HTML hiện có mà CHỈ đổi text, GIỮ NGUYÊN style/markup (gồm chấm tròn). Mục thêm mới
 * nhân bản mục cuối (kế thừa CSS), bớt thì gỡ node. HTML trống / không tìm thấy container → sinh mặc định.
 */
export function mergeTrustBadgesIntoHtml(items, existingHtml) {
  const fresh = serializeTrustBadges(items)
  if (!existingHtml || typeof existingHtml !== 'string' || !existingHtml.trim()) return fresh
  if (typeof DOMParser === 'undefined') return fresh
  try {
    const doc = new DOMParser().parseFromString(existingHtml, 'text/html')
    const container = findContainer(doc)
    if (!container) return fresh

    const contents = (items || []).map(contentOf).filter(Boolean)
    if (contents.length === 0) {
      container.remove()
      return doc.body.innerHTML.trim() ? doc.body.innerHTML : ''
    }

    let badges = [...container.children]
    if (badges.length === 0) return fresh
    while (badges.length < contents.length) {
      const clone = badges[badges.length - 1].cloneNode(true)
      container.appendChild(clone)
      badges = [...container.children]
    }
    while (badges.length > contents.length) {
      badges[badges.length - 1].remove()
      badges = [...container.children]
    }
    contents.forEach((c, i) => {
      if (badges[i]) setBadgeText(doc, badges[i], c)
    })
    return doc.body.innerHTML
  } catch {
    return fresh
  }
}
