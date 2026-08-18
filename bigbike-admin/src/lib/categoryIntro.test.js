import { describe, it, expect } from 'vitest'
import { emptyIntro, getIntroInputMode, isStructuredIntroHtml, parseIntro, serializeIntro } from './categoryIntro'

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

  it('dựng đủ 3 khối với class và FAQ có cấu trúc', () => {
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
    expect(html).not.toContain('itemscope')
    expect(html).not.toContain('itemtype=')
    expect(html).not.toContain('itemprop=')
    expect(html).toContain('<span class="bb-ci-b-head">1 câu hỏi thường gặp nhất</span>')
    expect(html).toContain('<h3 class="bb-ci-qt">Chọn loại nào?</h3>')
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

describe('intro input mode detection', () => {
  it('mở HTML do form sinh ra ở tab có cấu trúc, cho cả VI và EN', () => {
    const vi = serializeIntro(model({ heading: 'Mũ bảo hiểm' }), 'vi')
    const en = serializeIntro(model({ heading: 'Motorcycle helmets' }), 'en')

    expect(isStructuredIntroHtml(vi)).toBe(true)
    expect(getIntroInputMode(vi)).toBe('structured')
    expect(isStructuredIntroHtml(en)).toBe(true)
    expect(getIntroInputMode(en)).toBe('structured')
  })

  it('vẫn nhận diện markup FAQ structured cũ có microdata', () => {
    const current = serializeIntro(model({ faqs: [{ question: 'Q', answer: 'A' }] }), 'vi')
    const legacy = current
      .replace('<div class="bb-ci-b">', '<div class="bb-ci-b" itemscope itemtype="https://schema.org/FAQPage">')
      .replace('<div class="bb-ci-faq">', '<div class="bb-ci-faq" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">')
      .replace('<h3 class="bb-ci-qt">Q</h3>', '<span class="bb-ci-qt" itemprop="name">Q</span>')
      .replace('<div><p class="bb-ci-at">A</p></div>', '<div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p class="bb-ci-at" itemprop="text">A</p></div>')

    expect(isStructuredIntroHtml(legacy)).toBe(true)
    expect(getIntroInputMode(legacy)).toBe('structured')
  })

  it('mở raw HTML, bảng và markup thêm vào ở tab nâng cao', () => {
    const cases = [
      '<p>Nội dung cũ</p>',
      '<table><tbody><tr><td>Bảng cỡ</td></tr></tbody></table>',
      `${serializeIntro(model({ heading: 'Mũ' }), 'vi')}<p>Phần riêng</p>`,
    ]

    cases.forEach((html) => {
      expect(isStructuredIntroHtml(html)).toBe(false)
      expect(getIntroInputMode(html)).toBe('advanced')
    })
  })

  it('cho phép định dạng inline an toàn trong giới thiệu và câu trả lời', () => {
    const html = serializeIntro(model({
      intro: '<strong>Nội dung</strong> <em>nhấn mạnh</em><br><a href="https://bigbike.vn">Xem thêm</a>',
      faqs: [{ question: 'Q', answer: '<b>Đáp</b> <i>chi tiết</i><br><a href="/lien-he">Liên hệ</a>' }],
    }), 'vi')

    expect(isStructuredIntroHtml(html)).toBe(true)
    expect(getIntroInputMode(html)).toBe('structured')
    expect(parseIntro(html).intro).toContain('<strong>Nội dung</strong>')
    expect(parseIntro(html).faqs[0].answer).toContain('<a href="/lien-he">Liên hệ</a>')
  })

  it('đẩy thuộc tính hoặc thẻ không an toàn sang tab nâng cao', () => {
    const cases = [
      serializeIntro(model({ intro: 'Nội dung' }), 'vi').replace('Nội dung', '<span style="color:red">Nội dung</span>'),
      serializeIntro(model({ intro: 'Nội dung' }), 'vi').replace('Nội dung', '<a href="javascript:alert(1)">Nội dung</a>'),
      serializeIntro(model({ faqs: [{ question: 'Q', answer: 'A' }] }), 'vi').replace('>A</p>', '><ul><li>A</li></ul></p>'),
    ]

    cases.forEach((html) => {
      expect(isStructuredIntroHtml(html)).toBe(false)
      expect(getIntroInputMode(html)).toBe('advanced')
    })
  })

  it('bỏ qua khoảng trắng và dấu nháy cong vô hại khi dò khuôn', () => {
    const html = serializeIntro(model({ heading: '“Mũ bảo hiểm”', intro: 'Nội dung' }), 'vi')
      .replace(/\n/g, '\r\n')

    expect(isStructuredIntroHtml(html)).toBe(true)
  })

  it('coi nội dung rỗng là có cấu trúc mặc định', () => {
    expect(isStructuredIntroHtml('')).toBe(true)
    expect(getIntroInputMode('   ')).toBe('structured')
  })
})
