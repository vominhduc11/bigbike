import { sanitizeInlineHtml } from './sanitizeHtml'

/**
 * Chuyển đổi giữa danh sách thẻ "Phù hợp với ai" (model nhập có cấu trúc) và HTML —
 * để tab "Dán mã HTML" của khối luôn hiển thị sẵn mã tương ứng với các thẻ (giống Bảng size),
 * và để chuyển qua lại 2 chế độ không mất nội dung.
 *
 * Mỗi thẻ: { audience, advice }. HTML xuất ra phản chiếu đúng cách web render thẻ:
 * <strong>đối tượng</strong> → lời khuyên.
 *
 * LƯU Ý nguồn sự thật: chế độ có cấu trúc vẫn ghi `cards`, `html` để trống → web render thẻ.
 * HTML sinh ra ở đây chỉ để HIỂN THỊ trong admin; chỉ khi admin tự sửa khác đi thì `html` mới
 * được lưu và "thắng" cards (theo DATA_CONTRACT §khối suitability).
 */

export function emptySuitabilityCard() {
  return { audience: '', advice: '' }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SUITABILITY_LIST_STYLE =
  'list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;font-family:var(--bb-font-body);font-size:var(--bb-text-a4-content);line-height:1.5;color:var(--bb-text-secondary);'
const SUITABILITY_ITEM_STYLE = 'margin:0;'
const SUITABILITY_AUDIENCE_STYLE = 'color:var(--bb-text-primary);font-weight:700;'

function normalizeCard(c) {
  return {
    audience: (c?.audience || '').trim(),
    advice: (c?.advice || '').trim(),
  }
}

/** Thẻ có nội dung không (dùng để lọc thẻ rỗng khi serialize/parse, và khi admin xoá thẻ/dọn payload). */
export function suitabilityCardHasContent(c) {
  return Boolean(((c?.audience || '') + (c?.advice || '')).trim())
}

/** cards[] → HTML (rỗng nếu không thẻ nào có nội dung). */
export function serializeSuitabilityCards(cards) {
  const items = (cards || []).map(normalizeCard).filter((c) => suitabilityCardHasContent(c))
  if (items.length === 0) return ''
  const lis = items.map((c) => `<li style="${SUITABILITY_ITEM_STYLE}">${cardInnerHtml(c)}</li>`)
  return `<ul class="suitability-list" style="${SUITABILITY_LIST_STYLE}">${lis.join('')}</ul>`
}

/** Dựng nội dung BÊN TRONG một thẻ từ card (giữ phần tử thẻ ngoài + style/class của nó). */
function cardInnerHtml(c) {
  let inner = ''
  if (c.audience) inner += `<strong style="${SUITABILITY_AUDIENCE_STYLE}">${sanitizeInlineHtml(c.audience)}</strong>`
  if (c.audience && c.advice) inner += ' → '
  if (c.advice) inner += escapeHtml(c.advice)
  return inner
}

function mergeCardIntoElement(element, card) {
  const existingAudience = element.querySelector('strong, b')
  const audience = existingAudience
    ? existingAudience.cloneNode(false)
    : element.ownerDocument.createElement('strong')
  if (!existingAudience) audience.setAttribute('style', SUITABILITY_AUDIENCE_STYLE)
  audience.innerHTML = sanitizeInlineHtml(card.audience)
  element.replaceChildren()
  if (card.audience) element.appendChild(audience)
  if (card.audience && card.advice) element.appendChild(element.ownerDocument.createTextNode(' → '))
  if (card.advice) element.appendChild(element.ownerDocument.createTextNode(card.advice))
}

/**
 * Ghép danh sách thẻ vào HTML hiện có mà GIỮ NGUYÊN khung thẻ + style/class của nó, chỉ dựng lại
 * phần chữ bên trong (đối tượng → lời khuyên → link). Dùng khi admin sửa ở tab "Có cấu trúc" nhưng
 * HTML đã tùy chỉnh CSS. Thẻ thêm mới nhân bản thẻ cuối (kế thừa CSS); thẻ bớt thì gỡ node.
 * HTML trống / không có <li>|<p> để map → sinh mặc định serializeSuitabilityCards.
 */
export function mergeSuitabilityIntoHtml(cards, existingHtml) {
  const model = (cards || []).map(normalizeCard).filter((c) => suitabilityCardHasContent(c))
  const fresh = serializeSuitabilityCards(model)
  if (!existingHtml || typeof existingHtml !== 'string' || !existingHtml.trim()) return fresh
  if (typeof DOMParser === 'undefined') return fresh
  try {
    const doc = new DOMParser().parseFromString(existingHtml, 'text/html')
    const headingPairs = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .map((heading) => {
        const answer = heading.nextElementSibling
        return answer?.tagName === 'P' ? { heading, answer } : null
      })
      .filter(Boolean)
    if (headingPairs.length && headingPairs.length === model.length) {
      if (model.length === 0) {
        headingPairs.forEach(({ heading, answer }) => { heading.remove(); answer.remove() })
      } else {
        model.forEach((card, index) => {
          const pair = headingPairs[index]
          pair.heading.innerHTML = sanitizeInlineHtml(card.audience)
          pair.answer.innerHTML = sanitizeInlineHtml(card.advice)
        })
      }
      return doc.body.innerHTML.trim() ? doc.body.innerHTML : ''
    }
    let items = [...doc.querySelectorAll('li')]
    if (!items.length) items = [...doc.querySelectorAll('p')].filter((p) => (p.textContent || '').trim())
    const container = items[0]?.parentElement
    if (!items.length || !container) return fresh

    if (model.length === 0) {
      // Không còn thẻ: gỡ toàn bộ item; nếu container rỗng thì để body rỗng.
      items.forEach((el) => el.remove())
      return doc.body.innerHTML.trim() ? doc.body.innerHTML : ''
    }

    // Thêm/bớt item cho khớp số thẻ (item thêm nhân bản item cuối → giữ style).
    while (items.length < model.length) {
      const clone = items[items.length - 1].cloneNode(true)
      container.appendChild(clone)
      items = [...container.children].filter((el) => el.matches('li, p'))
    }
    while (items.length > model.length) {
      items[items.length - 1].remove()
      items = items.slice(0, -1)
    }
    model.forEach((c, i) => { if (items[i]) mergeCardIntoElement(items[i], c) })
    return doc.body.innerHTML
  } catch {
    return fresh
  }
}

function parseSuitabilityElement(el) {
  const strongEl = el.querySelector('strong, b')
  const clone = el.cloneNode(true)
  // Bỏ hẳn <a> (link gợi ý cũ nếu HTML còn giữ) để không lẫn vào lời khuyên.
  clone.querySelectorAll('strong, b, a').forEach((n) => n.remove())
  const rawAdvice = (clone.textContent || '').replace(/\s+/g, ' ').trim()
  const parts = rawAdvice.split(/\s*→\s*/)
  const audience = strongEl?.innerHTML || (!strongEl && parts.length > 1 ? parts[0] : '')
  const advice = strongEl
    ? rawAdvice.replace(/→/g, ' ').replace(/\s+/g, ' ').trim()
    : (parts.length > 1 ? parts.slice(1).join(' → ').trim() : rawAdvice)
  return normalizeCard({ audience, advice })
}

function parseHeadingSuitability(doc) {
  const items = []
  let skippedCount = 0
  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')]
  headings.forEach((heading) => {
    const next = heading.nextElementSibling
    if (!next || !['P', 'UL', 'OL'].includes(next.tagName)) return
    const elements = next.tagName === 'P' ? [next] : [...next.querySelectorAll('li')]
    if (next.tagName !== 'P' && elements.some((element) => element.querySelector('strong, b') || /→/.test(element.textContent || ''))) return
    if (!elements.length) {
      skippedCount += 1
      return
    }
    elements.forEach((element) => {
      const parsed = parseSuitabilityElement(element)
      const card = normalizeCard({ audience: heading.innerHTML, advice: parsed.advice })
      if (suitabilityCardHasContent(card)) items.push(card)
      else skippedCount += 1
    })
  })
  return { items, skippedCount }
}

/** Detailed tolerant parser used by the safe HTML import flow. */
export function parseSuitabilityResult(html) {
  if (!html || typeof html !== 'string' || !html.trim() || typeof DOMParser === 'undefined') {
    return { items: [], acceptedCount: 0, skippedCount: 0, hasInput: Boolean(html?.trim()) }
  }
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const headingResult = parseHeadingSuitability(doc)
    if (headingResult.items.length) {
      return {
        items: headingResult.items,
        acceptedCount: headingResult.items.length,
        skippedCount: headingResult.skippedCount,
        hasInput: true,
      }
    }
    const lis = [...doc.querySelectorAll('li')]
    const paragraphs = [...doc.querySelectorAll('p')]
    const source = lis.length ? lis : paragraphs
    const items = source.map(parseSuitabilityElement).filter(suitabilityCardHasContent)
    return {
      items,
      acceptedCount: items.length,
      skippedCount: source.length - items.length + (items.length ? 0 : 1),
      hasInput: true,
    }
  } catch {
    return { items: [], acceptedCount: 0, skippedCount: 1, hasInput: true }
  }
}

/** HTML → cards[] (best-effort; giữ API cũ cho caller hiện có). */
export function parseSuitabilityCards(html) {
  return parseSuitabilityResult(html).items
}
