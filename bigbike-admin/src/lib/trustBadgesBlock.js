import { generateId } from '@/lib/utils'
import { hasHtmlInput, makeHtmlImportResult } from './htmlImport'

/**
 * Chuyển đổi giữa danh sách "Dải tin cậy" có cấu trúc (model nhập trong admin) và HTML lưu vào
 * `trustBadges` — web render HTML thay cho dải có cấu trúc (V257). Model: [{ _key, content }].
 *
 * HTML sinh ra là một dải flex tự chứa (inline-style dùng token canonical web `--bb-font-body`/
 * `--bb-text-a5-meta`/`--bb-text-secondary`/`--bb-action-primary`, kèm hex fallback cho các token
 * không đổi theo breakpoint) mô phỏng dải tin cậy trên tên sản phẩm. Container có class
 * `bb-trust-badges` để round-trip ổn định; sửa cấu trúc chỉ đổi chữ, giữ nguyên style/markup (gồm
 * chấm tròn). `line-height:1` khớp `leading-none` mà web ép trên dải này (PurchaseSection.tsx).
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
  'font-family:var(--bb-font-body);font-size:var(--bb-text-a5-meta);line-height:1;' +
  'color:var(--bb-text-secondary,#6f6f6f)'
const BADGE_STYLE = 'display:flex;align-items:center;gap:8px;line-height:1'
const DOT_STYLE = 'height:6px;width:6px;flex:none;background:var(--bb-action-primary,#cc0906)'

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

function findBadgeElements(doc) {
  const marked = doc.querySelector('.bb-trust-badges')
  if (marked) return [...marked.children]
  const listItems = [...doc.querySelectorAll('li')]
  if (listItems.length) return listItems
  const paragraphs = [...doc.querySelectorAll('p')]
  if (paragraphs.length) return paragraphs
  const direct = [...doc.body.children]
  if (direct.length > 1) return direct
  return direct
}

// Ký tự chấm tròn/bullet trang trí có thể đứng lẫn trong chữ (HTML nhập ngoài dùng "• Chữ").
const BULLET_CHARS = '•·●○◦▪▫∙‣⁃'
const LEADING_BULLET_RE = new RegExp(`^[${BULLET_CHARS}]+\\s*`)
const ONLY_BULLET_RE = new RegExp(`^[${BULLET_CHARS}]+$`)

/**
 * Lấy phần chữ của một badge: dùng textContent đầy đủ rồi bỏ chấm tròn/bullet dẫn đầu. Hỗ trợ cả
 * markup canonical (chấm nằm ở span rỗng riêng → textContent chỉ còn chữ) lẫn HTML nhập ngoài
 * (chấm là ký tự "•" đứng trước chữ trong cùng badge, vd "• Chính hãng").
 */
function badgeText(el) {
  const raw = (el.textContent || '').replace(/\s+/g, ' ').trim()
  return raw.replace(LEADING_BULLET_RE, '').trim()
}

/** Span "chấm tròn" trang trí: rỗng hoặc chỉ chứa ký tự bullet (không phải chữ nội dung). */
function isDotSpan(span) {
  const txt = (span.textContent || '').trim()
  return txt === '' || ONLY_BULLET_RE.test(txt)
}

/** Detailed tolerant parser used by the safe HTML import flow. */
export function parseTrustBadgesResult(html) {
  if (!hasHtmlInput(html) || typeof DOMParser === 'undefined') {
    return makeHtmlImportResult({ hasInput: hasHtmlInput(html) })
  }
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const elements = findBadgeElements(doc)
    const items = elements
      .map((el) => ({ _key: generateId(), content: badgeText(el) }))
      .filter((b) => b.content)
    return makeHtmlImportResult({ items, skippedCount: elements.length - items.length + (items.length ? 0 : 1), hasInput: true })
  } catch {
    return makeHtmlImportResult({ skippedCount: 1, hasInput: true })
  }
}

/** HTML → items[] (best-effort; giữ API cũ cho caller hiện có). */
export function parseTrustBadgesFromHtml(html) {
  return parseTrustBadgesResult(html).items
}

/**
 * Đặt phần chữ cho 1 badge mà GIỮ NGUYÊN chấm tròn/markup. Ghi vào span "chữ" sẵn có (span không
 * phải chấm, không lồng phần tử con). Nếu badge nhúng chữ dạng text node trần cạnh chấm (HTML nhập
 * ngoài, vd "• Chữ") thì gỡ text node đó rồi tạo span chữ mới — tránh nhân đôi chữ khi ghép.
 */
function setBadgeText(doc, el, content) {
  const spans = [...el.querySelectorAll('span')]
  const dot = spans.find(isDotSpan)
  const textSpan = spans.find((s) => s !== dot && s.children.length === 0)
  if (textSpan) {
    textSpan.textContent = content
    return
  }
  // Gỡ mọi text node trần trực tiếp trên badge (chữ nằm ngoài span) để không lặp lại khi ghép.
  ;[...el.childNodes].forEach((n) => { if (n.nodeType === 3) el.removeChild(n) })
  const span = doc.createElement('span')
  span.textContent = content
  el.appendChild(span)
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
    const badgesFromHtml = findBadgeElements(doc)
    const container = badgesFromHtml[0]?.parentElement
    if (!container || !badgesFromHtml.length) return fresh

    const contents = (items || []).map(contentOf).filter(Boolean)
    if (contents.length === 0) {
      if (container.matches('.bb-trust-badges, ul')) container.remove()
      else badgesFromHtml.forEach((badge) => badge.remove())
      return doc.body.innerHTML.trim() ? doc.body.innerHTML : ''
    }

    let badges = badgesFromHtml
    while (badges.length < contents.length) {
      const clone = badges[badges.length - 1].cloneNode(true)
      container.appendChild(clone)
      badges = [...badges, clone]
    }
    while (badges.length > contents.length) {
      badges[badges.length - 1].remove()
      badges = badges.slice(0, -1)
    }
    contents.forEach((c, i) => {
      if (badges[i]) setBadgeText(doc, badges[i], c)
    })
    return doc.body.innerHTML
  } catch {
    return fresh
  }
}
