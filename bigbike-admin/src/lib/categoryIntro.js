import { generateId } from '@/lib/utils'
import DOMPurify from 'dompurify'

/**
 * Chuyển đổi giữa MODEL có cấu trúc (form nhập "Nội dung đầu trang danh mục") và HTML khối
 * `bb-cat-intro` lưu vào `introContent`. Như suitabilityCards/specStatsBlock: form chỉ là CÔNG CỤ
 * NHẬP; HTML vẫn là nguồn web render, nên giao diện khách KHÔNG đổi.
 *
 * Khối gồm 3 phần: A (eyebrow + tiêu đề + đoạn giới thiệu + thẻ thương hiệu), B (danh sách câu
 * hỏi thường gặp), C (nút liên hệ Zalo). Phần khung cố định (icon, dòng "N câu hỏi…", aria-label)
 * do serializer tự dựng theo `lang` + số câu hỏi; FAQPage JSON-LD được web dựng thành một khối riêng.
 */

// Icon chat Zalo — chỉ là hình (UI art), không phải dữ liệu kinh doanh.
const ZALO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>'

const FAQ_HEAD = { vi: (n) => `${n} câu hỏi thường gặp nhất`, en: (n) => `${n} most common questions` }
const CTA_ARIA = { vi: 'Nhắn Zalo tư vấn', en: 'Message Zalo for advice' }
const INLINE_TAGS = new Set(['A', 'B', 'BR', 'EM', 'I', 'STRONG'])
const INLINE_ATTRS = new Set(['href', 'rel', 'target', 'title'])
const SAFE_LINK_RE = /^(?:https?:\/\/|mailto:|tel:|\/|#)/i

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

function text(el) {
  return el ? (el.textContent || '').trim() : ''
}

function inlineMarkup(el) {
  if (!el) return ''
  return el.querySelector('*') ? (el.innerHTML || '').trim() : (el.textContent || '').trim()
}

function normalizeComparisonText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s+/g, ' ')
}

function escapeInlineText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n?|\n/g, '<br>')
}

/**
 * Sanitize only the small inline fragment that structured mode is allowed to keep.
 * Tables, layout elements, styles and event handlers are deliberately not part of this policy.
 */
export function sanitizeCategoryIntroInlineHtml(value) {
  if (value == null || value === '') return ''
  return DOMPurify.sanitize(String(value), {
    ALLOWED_TAGS: ['a', 'b', 'br', 'em', 'i', 'strong'],
    ALLOWED_ATTR: ['href', 'rel', 'target', 'title'],
    ALLOW_DATA_ATTR: false,
  })
}

export function isSafeCategoryIntroInlineHtml(value) {
  if (value == null || value === '') return true
  if (typeof DOMParser === 'undefined') return false

  try {
    const doc = new DOMParser().parseFromString(`<div>${String(value)}</div>`, 'text/html')
    const wrapper = doc.body.firstElementChild
    if (!wrapper || doc.body.children.length !== 1) return false

    const elements = [wrapper, ...Array.from(wrapper.querySelectorAll('*'))]
    return elements.every((element) => {
      if (element === wrapper) return true
      if (!INLINE_TAGS.has(element.tagName)) return false
      for (const attribute of Array.from(element.attributes)) {
        if (!INLINE_ATTRS.has(attribute.name)) return false
      }
      if (element.tagName === 'A') {
        const href = (element.getAttribute('href') || '').trim()
        if (!href || !SAFE_LINK_RE.test(href)) return false
      }
      return true
    })
  } catch {
    return false
  }
}

function serializeInlineFragment(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (!/<[a-z][\s\S]*>/i.test(raw)) return escapeInlineText(raw)
  return sanitizeCategoryIntroInlineHtml(raw)
}

export function emptyFaq() {
  return { _key: generateId(), question: '', answer: '' }
}

export function emptyIntro() {
  return {
    eyebrow: '',
    heading: '',
    intro: '',
    brands: [],
    faqs: [],
    ctaText: '',
    ctaLabel: '',
    ctaUrl: '',
    _legacy: false,
  }
}

function removeWhitespaceOnlyText(node) {
  Array.from(node.childNodes || []).forEach((child) => {
    if (child.nodeType === 3 && !(child.nodeValue || '').trim()) {
      child.remove()
      return
    }
    if (child.nodeType === 1) removeWhitespaceOnlyText(child)
  })
}

/**
 * Chuẩn hoá markup chỉ bỏ whitespace dùng để xuống dòng/thụt lề, vẫn giữ nguyên text và attribute.
 * So sánh DOM đã parse giúp chấp nhận khác biệt về quote/entity vô hại nhưng phát hiện được markup
 * riêng mà serializer không thể dựng lại.
 */
function normalizedMarkup(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  removeWhitespaceOnlyText(doc.body)
  Array.from(doc.body.querySelectorAll('*')).forEach((element) => {
    Array.from(element.childNodes || []).forEach((child) => {
      if (child.nodeType === 3) child.nodeValue = normalizeComparisonText(child.nodeValue)
    })
  })
  return doc.body.innerHTML
}

/**
 * Một số bản ghi structured cũ còn FAQ microdata do các migration trước tạo ra. Đây là markup do
 * chính template sinh ra, không phải phần trình bày riêng, nên detector phải coi nó là structured;
 * serializer hiện tại sẽ chỉ chuẩn hoá lại khi người dùng thực sự sửa form.
 */
function normalizeKnownLegacyMarkup(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll('.bb-ci-qt').forEach((element) => {
    const attrs = Array.from(element.attributes).map((attribute) => attribute.name)
    const isLegacyQuestion = element.tagName === 'SPAN'
      && attrs.every((attribute) => ['class', 'itemprop'].includes(attribute))
    if (!isLegacyQuestion) return
    const heading = doc.createElement('h3')
    heading.className = 'bb-ci-qt'
    heading.innerHTML = element.innerHTML
    element.replaceWith(heading)
  })
  doc.body.querySelectorAll('*').forEach((element) => {
    ;['itemscope', 'itemprop', 'itemtype'].forEach((attribute) => element.removeAttribute(attribute))
  })
  return doc.body.innerHTML
}

/**
 * Kiểm tra HTML có đúng là output mà form cấu trúc có thể đọc/ghi lại hay không.
 * Không chỉ kiểm tra `.bb-cat-intro`: mọi bảng, style, node lạ, attribute lạ hoặc nội dung HTML lồng
 * trong các ô text đều phải mở ở tab nâng cao để không bị serialize mất.
 */
export function isStructuredIntroHtml(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return true
  if (typeof DOMParser === 'undefined') return false

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const roots = Array.from(doc.body.children)
    const root = roots[0]
    if (roots.length !== 1 || !root || root.className !== 'bb-cat-intro') return false
    if (!['vi', 'en'].includes(root.getAttribute('lang'))) return false

    const parsed = parseIntro(html)
    if (parsed._legacy) return false
    const inlineFragments = [
      root.querySelector('.bb-ci-body')?.innerHTML || '',
      ...Array.from(root.querySelectorAll('.bb-ci-at')).map((element) => element.innerHTML),
    ]
    if (inlineFragments.some((fragment) => !isSafeCategoryIntroInlineHtml(fragment))) return false

    return normalizedMarkup(normalizeKnownLegacyMarkup(html))
      === normalizedMarkup(serializeIntro(parsed, root.getAttribute('lang')))
  } catch {
    return false
  }
}

export function getIntroInputMode(html) {
  return isStructuredIntroHtml(html) ? 'structured' : 'advanced'
}

/** HTML → model. Nếu không phải khối `bb-cat-intro`: giữ text vào ô giới thiệu (không mất), `_legacy=true`. */
export function parseIntro(html) {
  const model = emptyIntro()
  if (!html || typeof html !== 'string' || !html.trim()) return model
  if (typeof DOMParser === 'undefined') {
    model.intro = html
    model._legacy = true
    return model
  }
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const root = doc.querySelector('.bb-cat-intro')
    if (!root) {
      model.intro = (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
      model._legacy = true
      return model
    }
    model.eyebrow = text(root.querySelector('.bb-ci-eyebrow'))
    model.heading = text(root.querySelector('.bb-ci-h2'))
    model.intro = inlineMarkup(root.querySelector('.bb-ci-body'))
    model.brands = Array.from(root.querySelectorAll('.bb-ci-pill'))
      .map((el) => (el.textContent || '').trim())
      .filter(Boolean)
    model.faqs = Array.from(root.querySelectorAll('.bb-ci-faq'))
      .map((faq) => ({
        _key: generateId(),
        question: text(faq.querySelector('.bb-ci-qt')),
        answer: inlineMarkup(faq.querySelector('.bb-ci-at')),
      }))
      .filter((f) => f.question || f.answer)
    model.ctaText = text(root.querySelector('.bb-ci-ct'))
    const btn = root.querySelector('.bb-ci-btn')
    model.ctaLabel = btn ? (btn.textContent || '').trim() : ''
    model.ctaUrl = btn ? (btn.getAttribute('href') || '').trim() : ''
    return model
  } catch {
    model.intro = html
    model._legacy = true
    return model
  }
}

/** model → HTML khối `bb-cat-intro` (rỗng khi không có nội dung nào). */
export function serializeIntro(model, lang) {
  if (!model) return ''
  const L = lang === 'en' ? 'en' : 'vi'
  const eyebrow = (model.eyebrow || '').trim()
  const heading = (model.heading || '').trim()
  const intro = (model.intro || '').trim()
  const brands = (model.brands || []).map((b) => (b || '').trim()).filter(Boolean)
  const faqs = (model.faqs || [])
    .map((f) => ({ question: (f.question || '').trim(), answer: (f.answer || '').trim() }))
    .filter((f) => f.question || f.answer)
  const ctaText = (model.ctaText || '').trim()
  const ctaLabel = (model.ctaLabel || '').trim()
  const ctaUrl = (model.ctaUrl || '').trim()

  if (!eyebrow && !heading && !intro && !brands.length && !faqs.length && !ctaText && !ctaLabel && !ctaUrl) {
    return ''
  }

  const aParts = []
  if (eyebrow) aParts.push(`    <span class="bb-ci-eyebrow">${escapeHtml(eyebrow)}</span>`)
  if (heading) aParts.push(`    <h2 class="bb-ci-h2">${escapeHtml(heading)}</h2>`)
  if (intro) aParts.push(`    <p class="bb-ci-body">${serializeInlineFragment(intro)}</p>`)
  if (brands.length) {
    const pills = brands.map((b) => `<span class="bb-ci-pill">${escapeHtml(b)}</span>`).join('')
    aParts.push(`    <div class="bb-ci-pills">\n      ${pills}\n    </div>`)
  }
  const blockA = aParts.length ? `  <div class="bb-ci-a">\n${aParts.join('\n')}\n  </div>` : ''

  let blockB = ''
  if (faqs.length) {
    const items = faqs
      .map(
        (f) =>
          `    <div class="bb-ci-faq">\n` +
          `      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><h3 class="bb-ci-qt">${escapeHtml(f.question)}</h3></div>\n` +
          `      <div><p class="bb-ci-at">${serializeInlineFragment(f.answer)}</p></div>\n` +
          `    </div>`,
      )
      .join('\n')
    blockB =
      `  <div class="bb-ci-b">\n` +
      `    <span class="bb-ci-b-head">${escapeHtml(FAQ_HEAD[L](faqs.length))}</span>\n` +
      `${items}\n` +
      `  </div>`
  }

  let blockC = ''
  if (ctaText || ctaLabel || ctaUrl) {
    const btn =
      ctaLabel || ctaUrl
        ? `    <a class="bb-ci-btn" href="${escapeAttr(ctaUrl)}" target="_blank" rel="noopener" aria-label="${escapeAttr(CTA_ARIA[L])}">${ZALO_SVG}${escapeHtml(ctaLabel)}</a>\n`
        : ''
    blockC = `  <div class="bb-ci-c">\n    <span class="bb-ci-ct">${escapeHtml(ctaText)}</span>\n${btn}  </div>`
  }

  const inner = [blockA, blockB, blockC].filter(Boolean).join('\n')
  return `<div class="bb-cat-intro" lang="${L}">\n${inner}\n</div>`
}
