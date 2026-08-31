import { generateId } from '@/lib/utils'
import { hasHtmlInput, makeHtmlImportResult, textOf } from './htmlImport'

/**
 * Chuyển đổi FAQ rich-text sang HTML để soạn nhanh trong admin.
 * Mảng `faqs` vẫn là nguồn dữ liệu duy nhất; HTML được parse ngược ngay khi gõ.
 */

function fieldsFor(isEn) {
  return isEn
    ? { question: 'questionEn', answer: 'answerEn' }
    : { question: 'question', answer: 'answer' }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function hasContent(item, fields) {
  return Boolean(
    String(item?.[fields.question] ?? '').trim() || String(item?.[fields.answer] ?? '').trim(),
  )
}

function topLevelFaqItems(doc) {
  return [...doc.querySelectorAll('.bb-faq-item')].filter(
    (element) => !element.parentElement?.closest('.bb-faq-item'),
  )
}

/** items[] → HTML FAQ. Câu hỏi luôn được escape vì đó là text, còn câu trả lời là rich-text HTML. */
export function serializeFaqsToHtml(items, isEn = false) {
  const fields = fieldsFor(isEn)
  const faqs = (items || []).filter((item) => hasContent(item, fields))
  if (faqs.length === 0) return ''

  const entries = faqs.map(
    (faq) =>
      `<div class="bb-faq-item"><h4 class="bb-faq-question">${escapeHtml(faq?.[fields.question])}</h4>` +
      `<div class="bb-faq-answer">${faq?.[fields.answer] || ''}</div></div>`,
  )
  return `<div class="bb-faqs-list">${entries.join('')}</div>`
}

function validFaq(question, answer) {
  return Boolean(question.trim() && answer.replace(/<[^>]*>/g, '').trim())
}

function parseCanonicalFaqs(doc) {
  const skipped = { count: 0 }
  const items = topLevelFaqItems(doc)
    .map((item) => {
      const question = textOf(item.querySelector('.bb-faq-question'))
      const answer = item.querySelector('.bb-faq-answer')?.innerHTML || ''
      if (!validFaq(question, answer)) {
        skipped.count += 1
        return null
      }
      return { question, answer }
    })
    .filter(Boolean)
  return { items, skippedCount: skipped.count }
}

function parseDefinitionFaqs(doc) {
  const items = []
  let skippedCount = 0
  const definitions = [...doc.querySelectorAll('dt')]
  definitions.forEach((questionEl) => {
    const answerEl = questionEl.nextElementSibling?.matches('dd')
      ? questionEl.nextElementSibling
      : null
    const question = textOf(questionEl)
    const answer = answerEl?.innerHTML || ''
    if (validFaq(question, answer)) items.push({ question, answer })
    else skippedCount += 1
  })
  return { items, skippedCount }
}

function parseListFaqs(doc) {
  const items = []
  let skippedCount = 0
  const listItems = [...doc.querySelectorAll('li')].filter(
    (item) => !item.parentElement?.closest('li'),
  )

  listItems.forEach((item) => {
    const questionIndex = [...item.children].findIndex(
      (element) => /^(STRONG|B|H[1-6])$/.test(element.tagName) && textOf(element),
    )
    if (questionIndex < 0) {
      skippedCount += 1
      return
    }
    const question = textOf(item.children[questionIndex])
    const clone = item.cloneNode(true)
    clone.children[questionIndex]?.remove()
    const answer = clone.innerHTML || ''
    if (validFaq(question, answer)) items.push({ question, answer })
    else skippedCount += 1
  })

  return { items, skippedCount }
}

function parseHeadingFaqs(doc) {
  const items = []
  let skippedCount = 0
  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(
    (heading) => !heading.closest('.bb-faq-item'),
  )

  headings.forEach((heading) => {
    const question = textOf(heading)
    const answerParts = []
    let sibling = heading.nextElementSibling
    while (sibling && !/^H[1-6]$/.test(sibling.tagName)) {
      if (textOf(sibling)) answerParts.push(sibling.outerHTML || sibling.innerHTML)
      sibling = sibling.nextElementSibling
    }
    const answer = answerParts.join('')
    if (validFaq(question, answer)) items.push({ question, answer })
    else skippedCount += 1
  })
  return { items, skippedCount }
}

/** HTML → FAQ theo markup chuẩn hoặc HTML thông thường dạng tiêu đề + phần trả lời. */
export function parseFaqsResult(html) {
  if (!hasHtmlInput(html) || typeof DOMParser === 'undefined') {
    return makeHtmlImportResult({ hasInput: hasHtmlInput(html) })
  }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const canonical = parseCanonicalFaqs(doc)
    if (canonical.items.length) return makeHtmlImportResult({ ...canonical, hasInput: true })

    const definitions = parseDefinitionFaqs(doc)
    if (definitions.items.length) {
      return makeHtmlImportResult({
        items: definitions.items,
        skippedCount: canonical.skippedCount + definitions.skippedCount,
        hasInput: true,
      })
    }

    const listFaqs = parseListFaqs(doc)
    if (listFaqs.items.length) {
      return makeHtmlImportResult({
        items: listFaqs.items,
        skippedCount: canonical.skippedCount + definitions.skippedCount + listFaqs.skippedCount,
        hasInput: true,
      })
    }

    const headings = parseHeadingFaqs(doc)
    if (headings.items.length) {
      return makeHtmlImportResult({
        items: headings.items,
        skippedCount:
          canonical.skippedCount +
          definitions.skippedCount +
          listFaqs.skippedCount +
          headings.skippedCount,
        hasInput: true,
      })
    }

    return makeHtmlImportResult({
      skippedCount:
        canonical.skippedCount +
        definitions.skippedCount +
        listFaqs.skippedCount +
        headings.skippedCount +
        1,
      hasInput: true,
    })
  } catch {
    return makeHtmlImportResult({ skippedCount: 1, hasInput: true })
  }
}

export function parseFaqsFromHtml(html) {
  return parseFaqsResult(html).items
}

/**
 * Gộp HTML đang soạn vào FAQ. Tiếng Việt được thêm/bớt câu hỏi; tiếng Anh chỉ cập nhật
 * questionEn/answerEn theo vị trí để không thay đổi số FAQ đã tạo ở tiếng Việt.
 */
export function mergeFaqsHtmlIntoItems(items, html, isEn = false) {
  const current = Array.isArray(items) ? items : []
  const faqs = parseFaqsResult(html).items
  const fields = fieldsFor(isEn)

  // An unreadable HTML draft is never an instruction to clear existing data.
  if (!faqs.length) return current

  if (isEn) {
    return current.map((item, index) => {
      const faq = faqs[index]
      return faq ? { ...item, [fields.question]: faq.question, [fields.answer]: faq.answer } : item
    })
  }

  return faqs.map((faq, index) => {
    const existing = current[index] || { _key: generateId(), questionEn: '', answerEn: '' }
    return {
      ...existing,
      _key: existing._key || generateId(),
      question: faq.question,
      answer: faq.answer,
      questionEn: existing.questionEn || '',
      answerEn: existing.answerEn || '',
    }
  })
}
