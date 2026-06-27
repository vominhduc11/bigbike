import { generateId } from '@/lib/utils'

/**
 * Chuyển đổi giữa MODEL có cấu trúc (form nhập "Nội dung đầu trang danh mục") và HTML khối
 * `bb-cat-intro` lưu vào `introContent`. Như suitabilityCards/specStatsBlock: form chỉ là CÔNG CỤ
 * NHẬP; HTML vẫn là nguồn web render, nên giao diện khách KHÔNG đổi.
 *
 * Khối gồm 3 phần: A (eyebrow + tiêu đề + đoạn giới thiệu + thẻ thương hiệu), B (danh sách câu
 * hỏi thường gặp, kèm schema.org FAQPage), C (nút liên hệ Zalo). Phần khung cố định (schema.org,
 * icon, dòng "N câu hỏi…", aria-label) do serializer tự dựng theo `lang` + số câu hỏi.
 */

// Icon chat Zalo — chỉ là hình (UI art), không phải dữ liệu kinh doanh.
const ZALO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.51 3.58 1.39 5.06L2 22l5.12-1.34C8.52 21.53 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.46-4.56-1.26l-.32-.19-3.34.88.88-3.26-.21-.34A7.93 7.93 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>'

const FAQ_HEAD = { vi: (n) => `${n} câu hỏi thường gặp nhất`, en: (n) => `${n} most common questions` }
const CTA_ARIA = { vi: 'Nhắn Zalo tư vấn', en: 'Message Zalo for advice' }

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

function text(el) {
  return el ? (el.textContent || '').trim() : ''
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
    model.intro = text(root.querySelector('.bb-ci-body'))
    model.brands = Array.from(root.querySelectorAll('.bb-ci-pill'))
      .map((el) => (el.textContent || '').trim())
      .filter(Boolean)
    model.faqs = Array.from(root.querySelectorAll('.bb-ci-faq'))
      .map((faq) => ({
        _key: generateId(),
        question: text(faq.querySelector('.bb-ci-qt')),
        answer: text(faq.querySelector('.bb-ci-at')),
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
  if (intro) aParts.push(`    <p class="bb-ci-body">${escapeHtml(intro)}</p>`)
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
          `    <div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">\n` +
          `      <div class="bb-ci-q"><span class="bb-ci-qbadge" aria-hidden="true">Q</span><span class="bb-ci-qt" itemprop="name">${escapeHtml(f.question)}</span></div>\n` +
          `      <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">${escapeHtml(f.answer)}</p></div>\n` +
          `    </div>`,
      )
      .join('\n')
    blockB =
      `  <div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">\n` +
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
