import { describe, expect, it } from 'vitest'
import {
  emptyIntro,
  getIntroInputMode,
  isStructuredIntroHtml,
  parseIntro,
  patchIntroHtml,
  serializeIntro,
} from './categoryIntro'

const model = (over = {}) => ({ ...emptyIntro(), ...over })

describe('category intro HTML source and structured reader', () => {
  it('keeps canonical serialization available for genuinely new content', () => {
    const html = serializeIntro(model({ heading: 'A & B <x>', brands: ['AGV'] }), 'vi')
    expect(html).toContain('A &amp; B &lt;x&gt;')
    expect(html).toContain('<span class="bb-ci-pill">AGV</span>')
  })

  it('recognizes a table plus six FAQ pairs in one shared wrapper', () => {
    const answers = Array.from({ length: 6 }, (_, index) => `<p class="bb-ci-at">Câu trả lời ${index + 1}.</p>`).join('')
    const html = `<div class="bb-cat-intro"><div class="bb-ci-a"><h2 class="bb-ci-h2">Mũ</h2><p class="bb-ci-body">Giới thiệu</p></div><table><tr><td>Bảng riêng</td></tr></table><div class="bb-ci-b"><div class="legacy-questions">${Array.from({ length: 6 }, (_, index) => `<h3 class="bb-ci-qt">Câu hỏi ${index + 1}?</h3>`).join('')}${answers}</div></div></div>`
    const parsed = parseIntro(html)

    expect(isStructuredIntroHtml(html)).toBe(true)
    expect(getIntroInputMode(html)).toBe('structured')
    expect(parsed.heading).toBe('Mũ')
    expect(parsed.faqs).toHaveLength(6)
    expect(parsed.faqs.map((faq) => faq.question)).toEqual(Array.from({ length: 6 }, (_, index) => `Câu hỏi ${index + 1}?`))
    expect(parsed.faqs.map((faq) => faq.answer)).toEqual(Array.from({ length: 6 }, (_, index) => `Câu trả lời ${index + 1}.`))
  })

  it('recognizes legacy microdata and incomplete managed content', () => {
    const html = `<section data-category-intro itemscope itemtype="https://schema.org/FAQPage"><h2 itemprop="headline">Helmets</h2><div itemprop="mainEntity" itemscope itemtype="https://schema.org/Question"><span itemprop="name">Which fit?</span><div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><p itemprop="text">Measure first.</p></div></div><div class="unmanaged"><img src="/safe.jpg" alt="Example" /></div></section>`
    const parsed = parseIntro(html)

    expect(parsed.heading).toBe('Helmets')
    expect(parsed.faqs).toHaveLength(1)
    expect(parsed.faqs[0]).toMatchObject({ question: 'Which fit?', answer: 'Measure first.' })
    expect(getIntroInputMode(html)).toBe('structured')
  })

  it('leaves an HTML-only table in the HTML tab without calling it an error', () => {
    const html = '<table><tbody><tr><td>Comparison</td></tr></tbody></table>'
    expect(parseIntro(html).heading).toBe('')
    expect(parseIntro(html).faqs).toEqual([])
    expect(isStructuredIntroHtml(html)).toBe(false)
    expect(getIntroInputMode(html)).toBe('advanced')
  })

  it('patches one managed field while preserving table, unknown blocks, order, and all FAQ pairs', () => {
    const html = `<div class="bb-cat-intro"><div class="bb-ci-a"><h2 class="bb-ci-h2">Cũ</h2><p class="bb-ci-body">Giới thiệu</p></div><div class="free-columns"><img src="/keep.jpg" alt="Keep" /></div><table class="comparison"><tbody><tr><td>Giữ nguyên</td></tr></tbody></table><div class="bb-ci-b"><div class="legacy-questions">${Array.from({ length: 6 }, (_, index) => `<h3 class="bb-ci-qt">Q${index + 1}</h3>`).join('')}${Array.from({ length: 6 }, (_, index) => `<p class="bb-ci-at">A${index + 1}</p>`).join('')}</div></div><div class="free-after"><p>Khối lạ</p></div></div>`
    const patched = patchIntroHtml(html, { field: 'heading', value: 'Mới' }, 'vi')
    const doc = new DOMParser().parseFromString(patched, 'text/html')
    const root = doc.querySelector('.bb-cat-intro')

    expect(root.querySelector('.bb-ci-h2').textContent).toBe('Mới')
    expect(root.querySelector('.comparison td').textContent).toBe('Giữ nguyên')
    expect(root.querySelector('.free-columns img')).not.toBeNull()
    expect(root.querySelector('.free-after p').textContent).toBe('Khối lạ')
    expect(Array.from(root.querySelectorAll('.bb-ci-qt')).map((node) => node.textContent)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'])
    expect(Array.from(root.querySelectorAll('.bb-ci-at')).map((node) => node.textContent)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'])
    expect(root.querySelector('table').compareDocumentPosition(root.querySelector('.bb-ci-b')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('patches FAQ content by global appearance order and inserts a new FAQ before the CTA', () => {
    const html = '<div class="bb-cat-intro"><div class="bb-ci-b"><h3 class="bb-ci-qt">Q1</h3><p class="bb-ci-at">A1</p></div><div class="bb-ci-c"><span class="bb-ci-ct">Contact</span></div></div>'
    const patched = patchIntroHtml(html, {
      field: 'faqs',
      value: [
        { question: 'Q mới 1', answer: 'A mới 1' },
        { question: 'Q mới 2', answer: 'A mới 2' },
      ],
    }, 'vi')
    const doc = new DOMParser().parseFromString(patched, 'text/html')
    const root = doc.querySelector('.bb-cat-intro')

    expect(Array.from(root.querySelectorAll('.bb-ci-qt')).map((node) => node.textContent)).toEqual(['Q mới 1', 'Q mới 2'])
    expect(Array.from(root.querySelectorAll('.bb-ci-at')).map((node) => node.textContent)).toEqual(['A mới 1', 'A mới 2'])
    expect(root.querySelector('.bb-ci-b').compareDocumentPosition(root.querySelector('.bb-ci-c')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('creates a managed root without deleting the supplied HTML when a new field is edited', () => {
    const patched = patchIntroHtml('<table><tr><td>Existing</td></tr></table>', { field: 'heading', value: 'Heading' }, 'en')
    expect(patched).toContain('Existing')
    expect(patched).toContain('Heading')
    expect(patched).toContain('class="bb-cat-intro"')
  })
})
