import { describe, it, expect } from 'vitest'
import { emptyIntro, parseIntro, serializeIntro } from './categoryIntro'

const model = (over = {}) => ({ ...emptyIntro(), ...over })

// So sánh model bỏ qua _key (random) và cờ _legacy.
function clean(m) {
  return {
    eyebrow: m.eyebrow,
    heading: m.heading,
    intro: m.intro,
    brands: m.brands,
    faqs: (m.faqs || []).map((f) => ({ question: f.question, answer: f.answer })),
    ctaText: m.ctaText,
    ctaLabel: m.ctaLabel,
    ctaUrl: m.ctaUrl,
  }
}

describe('serializeIntro', () => {
  it('model rỗng → chuỗi rỗng', () => {
    expect(serializeIntro(emptyIntro(), 'vi')).toBe('')
    expect(serializeIntro(null, 'vi')).toBe('')
  })

  it('dựng đủ 3 khối với class + schema.org', () => {
    const html = serializeIntro(
      model({
        eyebrow: 'Danh mục · mu-bao-hiem',
        heading: 'Mũ bảo hiểm chính hãng',
        intro: 'Mũ là thứ cần chọn kỹ.',
        brands: ['AGV', 'LS2'],
        faqs: [{ _key: 'x', question: 'Chọn loại nào?', answer: 'Tuỳ cách chạy.' }],
        ctaText: 'Cần tư vấn?',
        ctaLabel: 'Nhắn Zalo Mrs. Thư',
        ctaUrl: 'https://zalo.me/84764640679',
      }),
      'vi',
    )
    expect(html).toContain('<div class="bb-cat-intro" lang="vi">')
    expect(html).toContain('<span class="bb-ci-pill">AGV</span><span class="bb-ci-pill">LS2</span>')
    expect(html).toContain('itemtype="https://schema.org/FAQPage"')
    expect(html).toContain('<span class="bb-ci-b-head">1 câu hỏi thường gặp nhất</span>')
    expect(html).toContain('itemprop="name">Chọn loại nào?</span>')
    expect(html).toContain('<a class="bb-ci-btn" href="https://zalo.me/84764640679"')
  })

  it('lang=en đổi nhãn cố định', () => {
    const html = serializeIntro(model({ faqs: [{ question: 'Q', answer: 'A' }] }), 'en')
    expect(html).toContain('lang="en"')
    expect(html).toContain('1 most common questions')
  })

  it('bỏ khối khi không có nội dung (không câu hỏi → không khối FAQ)', () => {
    const html = serializeIntro(model({ heading: 'Chỉ tiêu đề' }), 'vi')
    expect(html).not.toContain('bb-ci-b')
    expect(html).not.toContain('bb-ci-c')
  })

  it('escape ký tự đặc biệt', () => {
    const html = serializeIntro(model({ heading: 'A & B <x>' }), 'vi')
    expect(html).toContain('A &amp; B &lt;x&gt;')
  })
})

describe('parseIntro', () => {
  it('round-trip giữ nguyên nội dung', () => {
    const src = model({
      eyebrow: 'Danh mục · balo',
      heading: 'Balo mô tô',
      intro: 'Giữ chắc ở tốc độ cao.',
      brands: ['LS2', 'Komine', 'Givi'],
      faqs: [
        { question: 'Câu 1?', answer: 'Đáp 1.' },
        { question: 'Câu 2?', answer: 'Đáp 2 & hơn nữa.' },
      ],
      ctaText: 'Cần tư vấn?',
      ctaLabel: 'Nhắn Zalo Mrs. Thư',
      ctaUrl: 'https://zalo.me/84764640679',
    })
    const parsed = parseIntro(serializeIntro(src, 'vi'))
    expect(clean(parsed)).toEqual(clean(src))
    expect(parsed._legacy).toBe(false)
  })

  it('HTML cũ không theo mẫu → đưa text vào ô giới thiệu, _legacy=true', () => {
    const parsed = parseIntro('<p>Bài SEO cũ một khối</p><p>Đoạn hai</p>')
    expect(parsed._legacy).toBe(true)
    expect(parsed.intro).toContain('Bài SEO cũ một khối')
    expect(parsed.intro).toContain('Đoạn hai')
    expect(parsed.faqs).toEqual([])
  })

  it('rỗng → model rỗng', () => {
    expect(parseIntro('')._legacy).toBe(false)
    expect(parseIntro('   ').faqs).toEqual([])
  })
})
