import { describe, expect, it } from 'vitest'
import { emptyIntro } from './categoryIntro'
import {
  buildCategoryIntroAiPrompt,
  mergeCategoryIntroAiModel,
  parseCategoryIntroAiInput,
} from './categoryIntroAi'

describe('parseCategoryIntroAiInput', () => {
  it('đọc khuôn tiếng Việt với bullet, thiếu dấu hai chấm, lời dẫn và phần thừa', () => {
    const result = parseCategoryIntroAiInput(`
      Dưới đây là nội dung gợi ý:
      - tiêu đề Mũ bảo hiểm chính hãng
      NHÃN NHỎ
      Danh mục · mũ bảo hiểm
      GIỚI THIỆU: Chọn mũ <strong>đúng chuẩn</strong><br>cho mỗi hành trình.
      THƯƠNG HIỆU: AGV, LS2, Caberg
      - HỎI: Nên chọn mũ nào?
      - ĐÁP: Hãy chọn theo nhu cầu và kích thước đầu.
      HỎI: Có được đổi size không?
      ĐÁP: Liên hệ BigBike để được hỗ trợ.
      BẢNG SO SÁNH:
      | Size | Vòng đầu |
      Chúc bạn bán hàng hiệu quả!
    `)

    expect(result.source).toBe('labels')
    expect(result.model.heading).toBe('Mũ bảo hiểm chính hãng')
    expect(result.model.eyebrow).toBe('Danh mục · mũ bảo hiểm')
    expect(result.model.intro).toContain('<strong>đúng chuẩn</strong>')
    expect(result.model.brands).toEqual(['AGV', 'LS2', 'Caberg'])
    expect(result.model.faqs).toHaveLength(2)
    expect(result.present).toEqual({ heading: true, eyebrow: true, intro: true, brands: true, faqs: true })
    expect(result.ignored).toContain('preamble')
    expect(result.ignored).toContain('unknown:BẢNG SO SÁNH')
  })

  it('đọc khuôn tiếng Anh, nhãn viết thường và footer của AI', () => {
    const result = parseCategoryIntroAiInput(`
      title Motorcycle helmets
      small label Premium selection
      intro: Find a safer fit with <em>trusted guidance</em>.
      brands: AGV; LS2
      question: Which type should I choose?
      answer: Choose the fit and coverage that match your riding.
      q: How do I pick a size?
      a: Measure your head and compare the brand chart.
      I hope this helps.
    `)

    expect(result.model.heading).toBe('Motorcycle helmets')
    expect(result.model.eyebrow).toBe('Premium selection')
    expect(result.model.brands).toEqual(['AGV', 'LS2'])
    expect(result.model.faqs).toHaveLength(2)
    expect(result.model.intro).toContain('<em>trusted guidance</em>')
  })

  it('đọc JSON có code fence và tên trường tương đương', () => {
    const result = parseCategoryIntroAiInput(`Here is the data:
      \`\`\`json
      {
        "title": "Motorcycle helmets",
        "smallLabel": "Premium selection",
        "description": "Choose <strong>the right fit</strong>.",
        "brands": ["AGV", "LS2"],
        "faqs": [
          { "q": "Which size?", "a": "Measure your head." },
          { "question": "Can I ask for advice?", "answer": "Yes, contact BigBike." }
        ],
        "comparisonTable": "ignore me"
      }
      \`\`\`
      `)

    expect(result.source).toBe('json')
    expect(result.model.heading).toBe('Motorcycle helmets')
    expect(result.model.intro).toContain('<strong>the right fit</strong>')
    expect(result.model.brands).toEqual(['AGV', 'LS2'])
    expect(result.model.faqs).toHaveLength(2)
    expect(result.ignored).toContain('json:comparisonTable')
  })

  it('báo phần vượt giới hạn và HTML ngoài danh sách an toàn', () => {
    const result = parseCategoryIntroAiInput(`
      GIỚI THIỆU: <table><tr><td>${'x'.repeat(2100)}</td></tr></table>
      HỎI: Câu hỏi
      ĐÁP: Câu trả lời
    `)

    expect(result.errors).toContain('intro:2000')
    expect(result.ignored).toContain('unsupportedHtml')
  })
})

describe('mergeCategoryIntroAiModel', () => {
  it('chỉ thay các trường AI thực sự nhận được và giữ CTA', () => {
    const current = {
      ...emptyIntro(),
      eyebrow: 'Nhãn cũ',
      heading: 'Tiêu đề cũ',
      intro: 'Đoạn cũ',
      brands: ['Cũ'],
      faqs: [{ _key: 'old', question: 'Cũ?', answer: 'Cũ.' }],
      ctaText: 'Cần tư vấn?',
      ctaLabel: 'Nhắn Zalo',
      ctaUrl: 'https://zalo.me/example',
    }
    const parsed = parseCategoryIntroAiInput('TIÊU ĐỀ: Tiêu đề mới\nTHƯƠNG HIỆU: AGV, LS2')
    const next = mergeCategoryIntroAiModel(current, parsed)

    expect(next.heading).toBe('Tiêu đề mới')
    expect(next.eyebrow).toBe('Nhãn cũ')
    expect(next.intro).toBe('Đoạn cũ')
    expect(next.brands).toEqual(['AGV', 'LS2'])
    expect(next.faqs).toEqual(current.faqs)
    expect(next.ctaUrl).toBe(current.ctaUrl)
  })
})

describe('buildCategoryIntroAiPrompt', () => {
  it('tự điền tên danh mục, ngôn ngữ, giới hạn và đúng năm cặp hỏi đáp', () => {
    const vi = buildCategoryIntroAiPrompt({ categoryName: 'Mũ bảo hiểm', lang: 'vi' })
    const en = buildCategoryIntroAiPrompt({ categoryName: 'Motorcycle helmets', lang: 'en' })

    expect(vi).toContain('"Mũ bảo hiểm"')
    expect(vi).toContain('Không trả về HTML')
    expect(vi.match(/HỎI:/g)).toHaveLength(5)
    expect(en).toContain('"Motorcycle helmets"')
    expect(en).toContain('Do not return HTML')
    expect(en.match(/QUESTION:/g)).toHaveLength(5)
  })
})
