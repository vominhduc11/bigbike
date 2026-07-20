import { generateId } from '@/lib/utils'

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
  return Boolean(String(item?.[fields.question] ?? '').trim() || String(item?.[fields.answer] ?? '').trim())
}

function topLevelFaqItems(doc) {
  return [...doc.querySelectorAll('.bb-faq-item')]
    .filter((element) => !element.parentElement?.closest('.bb-faq-item'))
}

/** items[] → HTML FAQ. Câu hỏi luôn được escape vì đó là text, còn câu trả lời là rich-text HTML. */
export function serializeFaqsToHtml(items, isEn = false) {
  const fields = fieldsFor(isEn)
  const faqs = (items || []).filter((item) => hasContent(item, fields))
  if (faqs.length === 0) return ''

  const entries = faqs.map((faq) => (
    `<div class="bb-faq-item"><h4 class="bb-faq-question">${escapeHtml(faq?.[fields.question])}</h4>` +
    `<div class="bb-faq-answer">${faq?.[fields.answer] || ''}</div></div>`
  ))
  return `<div class="bb-faqs-list">${entries.join('')}</div>`
}

/** HTML → FAQ theo markup .bb-faq-item. Câu hỏi được lấy dạng text, câu trả lời giữ rich-text. */
export function parseFaqsFromHtml(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return []
  if (typeof DOMParser === 'undefined') return []

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return topLevelFaqItems(doc).map((item) => {
      const question = (item.querySelector('.bb-faq-question')?.textContent || '').trim()
      const answer = item.querySelector('.bb-faq-answer')?.innerHTML || ''
      return { question, answer }
    })
  } catch {
    return []
  }
}

/**
 * Gộp HTML đang soạn vào FAQ. Tiếng Việt được thêm/bớt câu hỏi; tiếng Anh chỉ cập nhật
 * questionEn/answerEn theo vị trí để không thay đổi số FAQ đã tạo ở tiếng Việt.
 */
export function mergeFaqsHtmlIntoItems(items, html, isEn = false) {
  const current = Array.isArray(items) ? items : []
  const faqs = parseFaqsFromHtml(html)
  const fields = fieldsFor(isEn)

  if (isEn) {
    return current.map((item, index) => {
      const faq = faqs[index]
      return faq
        ? { ...item, [fields.question]: faq.question, [fields.answer]: faq.answer }
        : item
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
