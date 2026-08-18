import { generateId } from '@/lib/utils'
import DOMPurify from 'dompurify'

// `introContent` is HTML-first. These selectors describe only the fields the
// form knows how to edit; every other node remains opaque and is preserved.
const FAQ_HEAD = { vi: (n) => `${n} câu hỏi thường gặp nhất`, en: (n) => `${n} most common questions` }
const CTA_ARIA = { vi: 'Nhắn Zalo tư vấn', en: 'Message Zalo for advice' }
const INLINE_TAGS = new Set(['A', 'B', 'BR', 'EM', 'I', 'STRONG'])
const INLINE_ATTRS = new Set(['href', 'rel', 'target', 'title'])
const SAFE_LINK_RE = /^(?:https?:\/\/|mailto:|tel:|\/|#)/i
const ZALO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>'

export const CATEGORY_INTRO_LIMITS = Object.freeze({
  eyebrow: 120,
  heading: 255,
  intro: 2000,
  brand: 60,
  question: 300,
  answer: 1500,
})

const SELECTORS = {
  root: '.bb-cat-intro, [data-bb-category-intro], [data-category-intro]',
  eyebrow: '.bb-ci-eyebrow, [data-bb-intro="eyebrow"], [data-intro-field="eyebrow"]',
  heading: '.bb-ci-h2, [data-bb-intro="heading"], [data-intro-field="heading"]',
  intro: '.bb-ci-body, [data-bb-intro="intro"], [data-intro-field="intro"]',
  brandContainer: '.bb-ci-pills, [data-bb-intro="brands"], [data-intro-field="brands"]',
  brand: '.bb-ci-pill, [data-bb-brand], [data-intro-field="brand"]',
  faqQuestion: '.bb-ci-qt, .bb-faq-question, [data-bb-faq-question], [data-intro-field="faq-question"], [itemprop="name"]',
  faqAnswer: '.bb-ci-at, .bb-faq-answer, [data-bb-faq-answer], [data-intro-field="faq-answer"], [itemprop="text"]',
  faqItem: '.bb-ci-faq, .bb-faq-item, [data-bb-faq-item]',
  faqContainer: '.bb-ci-b, .bb-faqs-list, [data-bb-intro="faqs"]',
  faqHead: '.bb-ci-b-head, [data-bb-intro="faq-count"]',
  cta: '.bb-ci-c, [data-bb-intro="cta"], [data-intro-field="cta"]',
  ctaText: '.bb-ci-ct, [data-bb-intro="cta-text"], [data-intro-field="cta-text"]',
  ctaButton: '.bb-ci-btn, [data-bb-intro="cta-button"], [data-intro-field="cta-button"]',
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;')
}

function text(element) {
  return element ? (element.textContent || '').trim() : ''
}

function inlineMarkup(element) {
  if (!element) return ''
  return element.querySelector('*') ? (element.innerHTML || '').trim() : text(element)
}

function first(root, selector) {
  return root?.querySelector(selector) || null
}

function all(root, selector) {
  return root ? Array.from(root.querySelectorAll(selector)) : []
}

function findRoot(doc) {
  const direct = doc.querySelector(SELECTORS.root)
  if (direct) return direct

  // A few imported rows lost the root class but retained managed markers. Do
  // not treat arbitrary HTML as structured merely because it contains a <p>.
  return Array.from(doc.body.children).find((candidate) =>
    candidate.querySelector?.(`${SELECTORS.eyebrow}, ${SELECTORS.heading}, ${SELECTORS.intro}, ${SELECTORS.brand}, ${SELECTORS.faqQuestion}, ${SELECTORS.faqAnswer}, ${SELECTORS.ctaText}, ${SELECTORS.ctaButton}`),
  ) || null
}

function findManagedSlots(root) {
  if (!root) {
    return {
      eyebrow: null,
      heading: null,
      intro: null,
      brandContainer: null,
      brands: [],
      questions: [],
      answers: [],
      faqItems: [],
      faqContainer: null,
      faqHead: null,
      cta: null,
      ctaText: null,
      ctaButton: null,
    }
  }

  const heading = first(root, SELECTORS.heading) || first(root, 'h1, h2')
  const intro = first(root, SELECTORS.intro) || Array.from(root.querySelectorAll('p')).find((element) => !element.closest(SELECTORS.faqItem) && !element.closest(SELECTORS.cta)) || null
  const brandContainer = first(root, SELECTORS.brandContainer)
  const brands = all(brandContainer || root, SELECTORS.brand).filter((element) => !element.closest(SELECTORS.faqItem))
  const questions = all(root, SELECTORS.faqQuestion)
  const answers = all(root, SELECTORS.faqAnswer)
  const faqItems = all(root, SELECTORS.faqItem)
  const faqContainer = first(root, SELECTORS.faqContainer) || faqItems[0]?.parentElement || null
  const cta = first(root, SELECTORS.cta)

  return {
    eyebrow: first(root, SELECTORS.eyebrow) || first(root, 'small'),
    heading,
    intro,
    brandContainer,
    brands,
    questions,
    answers,
    faqItems,
    faqContainer,
    faqHead: first(root, SELECTORS.faqHead),
    cta,
    ctaText: first(root, SELECTORS.ctaText),
    ctaButton: first(root, SELECTORS.ctaButton),
  }
}

function hasManagedContent(slots) {
  return Boolean(
    slots.eyebrow || slots.heading || slots.intro || slots.brands.length ||
    slots.questions.length || slots.answers.length || slots.ctaText || slots.ctaButton,
  )
}

function safeInline(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (!/<[a-z][\s\S]*>/i.test(raw)) return escapeHtml(raw).replace(/\r\n?|\n/g, '<br>')
  return sanitizeCategoryIntroInlineHtml(raw)
}

/** Sanitize only fragments that the structured form is allowed to edit. */
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
    return [wrapper, ...Array.from(wrapper.querySelectorAll('*'))].every((element) => {
      if (element === wrapper) return true
      if (!INLINE_TAGS.has(element.tagName)) return false
      if (Array.from(element.attributes).some((attribute) => !INLINE_ATTRS.has(attribute.name))) return false
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

/** HTML → the recognized form model. Unknown/free content is intentionally not copied into a field. */
export function parseIntro(html) {
  const model = emptyIntro()
  if (!html || typeof html !== 'string' || !html.trim()) return model
  if (typeof DOMParser === 'undefined') return { ...model, _legacy: true }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const root = findRoot(doc)
    const slots = findManagedSlots(root)
    if (!root || !hasManagedContent(slots)) return { ...model, _legacy: true }

    model.eyebrow = text(slots.eyebrow)
    model.heading = text(slots.heading)
    model.intro = inlineMarkup(slots.intro)
    model.brands = slots.brands.map(text).filter(Boolean)
    const count = Math.max(slots.questions.length, slots.answers.length)
    model.faqs = Array.from({ length: count }, (_, index) => ({
      _key: generateId(),
      question: text(slots.questions[index]),
      answer: inlineMarkup(slots.answers[index]),
    })).filter((faq) => faq.question || faq.answer)
    model.ctaText = text(slots.ctaText)
    model.ctaLabel = text(slots.ctaButton)
    model.ctaUrl = slots.ctaButton?.getAttribute('href')?.trim() || ''
    return model
  } catch {
    return { ...model, _legacy: true }
  }
}

/** Any recognized managed field is enough to expose the form. Extra HTML is not an error. */
export function isStructuredIntroHtml(html) {
  if (!html || !String(html).trim()) return true
  if (typeof DOMParser === 'undefined') return false
  try {
    const doc = new DOMParser().parseFromString(String(html), 'text/html')
    return hasManagedContent(findManagedSlots(findRoot(doc)))
  } catch {
    return false
  }
}

export function getIntroInputMode(html) {
  return isStructuredIntroHtml(html) ? 'structured' : 'advanced'
}

function ensureElement(doc, parent, tagName, className, html = '', beforeSelector = '') {
  const element = doc.createElement(tagName)
  if (className) element.className = className
  if (html) element.innerHTML = html
  const before = beforeSelector ? parent.querySelector(beforeSelector) : null
  if (before) parent.insertBefore(element, before)
  else parent.appendChild(element)
  return element
}

function ensureIntroRoot(doc, lang) {
  let root = findRoot(doc)
  if (root) {
    if (!root.classList.contains('bb-cat-intro')) root.classList.add('bb-cat-intro')
    if (!root.getAttribute('lang')) root.setAttribute('lang', lang === 'en' ? 'en' : 'vi')
    return root
  }
  root = ensureElement(doc, doc.body, 'div', 'bb-cat-intro')
  root.setAttribute('lang', lang === 'en' ? 'en' : 'vi')
  return root
}

function ensureIntroSection(root, className, beforeSelector = '') {
  const existing = root.querySelector(`.${className}`)
  if (existing) return existing
  const section = root.ownerDocument.createElement('div')
  section.className = className
  const before = beforeSelector ? root.querySelector(beforeSelector) : null
  if (before) root.insertBefore(section, before)
  else root.appendChild(section)
  return section
}

function patchSimple(slots, root, field, value) {
  const clean = String(value ?? '').trim()
  const inline = field === 'intro'
  const tag = field === 'heading' ? 'h2' : field === 'eyebrow' ? 'span' : 'p'
  const className = field === 'heading' ? 'bb-ci-h2' : field === 'eyebrow' ? 'bb-ci-eyebrow' : 'bb-ci-body'
  let target = slots[field]
  if (!target) {
    const section = ensureIntroSection(root, 'bb-ci-a', '.bb-ci-b, .bb-ci-c')
    target = ensureElement(root.ownerDocument, section, tag, className)
  }
  target.innerHTML = inline ? safeInline(clean) : escapeHtml(clean)
  if (!clean) target.remove()
}

function patchBrands(slots, root, brands) {
  const values = (Array.isArray(brands) ? brands : []).map((brand) => String(brand || '').trim()).filter(Boolean)
  let container = slots.brandContainer
  if (!container && values.length) {
    const section = ensureIntroSection(root, 'bb-ci-a', '.bb-ci-b, .bb-ci-c')
    container = ensureElement(root.ownerDocument, section, 'div', 'bb-ci-pills')
  }
  if (!container) return
  const current = all(container, SELECTORS.brand)
  current.slice(values.length).forEach((element) => element.remove())
  values.forEach((value, index) => {
    const target = current[index] || ensureElement(root.ownerDocument, container, 'span', 'bb-ci-pill')
    target.textContent = value
  })
  if (!values.length && !container.children.length) container.remove()
}

function patchFaqs(slots, root, faqs, lang) {
  const values = (Array.isArray(faqs) ? faqs : [])
    .map((faq) => ({ question: String(faq?.question || '').trim(), answer: String(faq?.answer || '').trim() }))
    .filter((faq) => faq.question || faq.answer)
  let container = slots.faqContainer
  if (!container && values.length) container = ensureElement(root.ownerDocument, root, 'div', 'bb-ci-b', '', '.bb-ci-c')
  if (!container) return

  const items = all(container, SELECTORS.faqItem)
  const questions = all(container, SELECTORS.faqQuestion)
  const answers = all(container, SELECTORS.faqAnswer)
  values.forEach((faq, index) => {
    let question = questions[index]
    let answer = answers[index]
    if (!question || !answer) {
      const item = ensureElement(root.ownerDocument, container, 'div', 'bb-ci-faq')
      question = ensureElement(root.ownerDocument, item, 'h3', 'bb-ci-qt')
      answer = ensureElement(root.ownerDocument, item, 'p', 'bb-ci-at')
    }
    question.textContent = faq.question
    answer.innerHTML = safeInline(faq.answer)
  })

  // Remove only recognized surplus nodes. With one shared legacy wrapper we do
  // not remove the wrapper or any unrelated siblings.
  if (items.length) items.slice(values.length).forEach((item) => item.remove())
  else {
    questions.slice(values.length).forEach((node) => node.remove())
    answers.slice(values.length).forEach((node) => node.remove())
  }

  let head = first(container, SELECTORS.faqHead)
  if (!head && values.length) head = ensureElement(root.ownerDocument, container, 'span', 'bb-ci-b-head')
  if (head) {
    head.textContent = values.length ? FAQ_HEAD[lang === 'en' ? 'en' : 'vi'](values.length) : ''
    if (!values.length) head.remove()
  }
  if (!values.length && !container.textContent.trim() && !container.children.length) container.remove()
}

function patchCta(slots, root, field, value, lang) {
  const clean = String(value ?? '').trim()
  let cta = slots.cta
  if (!cta && clean) cta = ensureElement(root.ownerDocument, root, 'div', 'bb-ci-c')
  if (!cta) return
  if (field === 'ctaText') {
    let target = first(cta, SELECTORS.ctaText)
    if (!target && clean) target = ensureElement(root.ownerDocument, cta, 'span', 'bb-ci-ct')
    if (target) {
      target.textContent = clean
      if (!clean) target.remove()
    }
  } else if (field === 'ctaLabel' || field === 'ctaUrl') {
    let button = first(cta, SELECTORS.ctaButton)
    if (!button && clean) {
      button = ensureElement(root.ownerDocument, cta, 'a', 'bb-ci-btn')
      button.setAttribute('target', '_blank')
      button.setAttribute('rel', 'noopener')
      button.setAttribute('aria-label', CTA_ARIA[lang === 'en' ? 'en' : 'vi'])
      button.innerHTML = ZALO_SVG
    }
    if (button) {
      if (field === 'ctaLabel') {
        const icon = button.querySelector('svg')?.outerHTML || ''
        button.innerHTML = `${icon}${escapeHtml(clean)}`
      } else if (clean) button.setAttribute('href', clean)
      else button.removeAttribute('href')
      if (!text(button) && !button.getAttribute('href')) button.remove()
    }
  }
  if (!cta.textContent.trim() && !cta.querySelector('a[href], img, svg')) cta.remove()
}

/** Patch exactly one managed field in the existing HTML. */
export function patchIntroHtml(html, change, lang = 'vi') {
  const field = change?.field
  if (!field) return html || ''
  const current = typeof html === 'string' ? html : ''
  if (typeof DOMParser === 'undefined') return current

  const doc = new DOMParser().parseFromString(current || '<div></div>', 'text/html')
  const root = ensureIntroRoot(doc, lang)
  const slots = findManagedSlots(root)

  if (field === 'brands') patchBrands(slots, root, change.value)
  else if (field === 'faqs') patchFaqs(slots, root, change.value, lang)
  else if (field === 'ctaText' || field === 'ctaLabel' || field === 'ctaUrl') patchCta(slots, root, field, change.value, lang)
  else if (field === 'eyebrow' || field === 'heading' || field === 'intro') patchSimple(slots, root, field, change.value)

  return doc.body.innerHTML
}

/** model → canonical HTML for genuinely new content or explicit serializers. */
export function serializeIntro(model, lang) {
  if (!model) return ''
  const L = lang === 'en' ? 'en' : 'vi'
  const eyebrow = (model.eyebrow || '').trim()
  const heading = (model.heading || '').trim()
  const intro = (model.intro || '').trim()
  const brands = (model.brands || []).map((brand) => (brand || '').trim()).filter(Boolean)
  const faqs = (model.faqs || [])
    .map((faq) => ({ question: (faq.question || '').trim(), answer: (faq.answer || '').trim() }))
    .filter((faq) => faq.question || faq.answer)
  const ctaText = (model.ctaText || '').trim()
  const ctaLabel = (model.ctaLabel || '').trim()
  const ctaUrl = (model.ctaUrl || '').trim()

  if (!eyebrow && !heading && !intro && !brands.length && !faqs.length && !ctaText && !ctaLabel && !ctaUrl) return ''

  const aParts = []
  if (eyebrow) aParts.push(`    <span class="bb-ci-eyebrow">${escapeHtml(eyebrow)}</span>`)
  if (heading) aParts.push(`    <h2 class="bb-ci-h2">${escapeHtml(heading)}</h2>`)
  if (intro) aParts.push(`    <p class="bb-ci-body">${safeInline(intro)}</p>`)
  if (brands.length) {
    const pills = brands.map((brand) => `<span class="bb-ci-pill">${escapeHtml(brand)}</span>`).join('')
    aParts.push(`    <div class="bb-ci-pills">\n      ${pills}\n    </div>`)
  }
  const blockA = aParts.length ? `  <div class="bb-ci-a">\n${aParts.join('\n')}\n  </div>` : ''
  const blockB = faqs.length
    ? `  <div class="bb-ci-b">\n    <span class="bb-ci-b-head">${escapeHtml(FAQ_HEAD[L](faqs.length))}</span>\n${faqs.map((faq) =>
        `    <div class="bb-ci-faq">\n      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><h3 class="bb-ci-qt">${escapeHtml(faq.question)}</h3></div>\n      <div><p class="bb-ci-at">${safeInline(faq.answer)}</p></div>\n    </div>`).join('\n')}\n  </div>`
    : ''
  const button = ctaLabel || ctaUrl
    ? `    <a class="bb-ci-btn" href="${escapeAttr(ctaUrl)}" target="_blank" rel="noopener" aria-label="${escapeAttr(CTA_ARIA[L])}">${ZALO_SVG}${escapeHtml(ctaLabel)}</a>\n`
    : ''
  const blockC = ctaText || ctaLabel || ctaUrl
    ? `  <div class="bb-ci-c">\n    <span class="bb-ci-ct">${escapeHtml(ctaText)}</span>\n${button}  </div>`
    : ''

  return `<div class="bb-cat-intro" lang="${L}">\n${[blockA, blockB, blockC].filter(Boolean).join('\n')}\n</div>`
}
