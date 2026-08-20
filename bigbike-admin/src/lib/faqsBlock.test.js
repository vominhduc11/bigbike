import { describe, expect, it } from 'vitest'
import {
  mergeFaqsHtmlIntoItems,
  parseFaqsResult,
  parseFaqsFromHtml,
  serializeFaqsToHtml,
} from './faqsBlock'

const faq = (question, answer, questionEn = '', answerEn = '', _key = undefined) => ({
  question,
  answer,
  questionEn,
  answerEn,
  ...(_key ? { _key } : {}),
})

describe('serializeFaqsToHtml / parseFaqsFromHtml', () => {
  it('round-trip giữ câu hỏi và rich-text câu trả lời', () => {
    const items = [
      faq('Mũ này có Pinlock không?', '<p>Có, đi kèm Pinlock 70.</p>'),
      faq('Bảo hành bao lâu?', '<p><strong>24 tháng</strong> chính hãng.</p>'),
    ]

    const html = serializeFaqsToHtml(items, false)
    expect(html).toContain('class="bb-faq-item"')
    expect(parseFaqsFromHtml(html)).toEqual(
      items.map(({ question, answer }) => ({ question, answer })),
    )
  })

  it('escape câu hỏi để không đưa HTML từ trường text vào markup', () => {
    const html = serializeFaqsToHtml(
      [faq('<img src=x onerror=alert(1)> & giá?', '<p>Không.</p>')],
      false,
    )

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; giá?')
    expect(html).not.toContain('<img src=x')
    expect(parseFaqsFromHtml(html)[0].question).toBe('<img src=x onerror=alert(1)> & giá?')
  })

  it('đọc HTML thông thường dạng tiêu đề nhỏ + đoạn trả lời', () => {
    const result = parseFaqsResult('<h3>Mũ có Pinlock không?</h3><p>Có, kèm Pinlock 70.</p>')
    expect(result.items).toEqual([
      { question: 'Mũ có Pinlock không?', answer: '<p>Có, kèm Pinlock 70.</p>' },
    ])
    expect(result.acceptedCount).toBe(1)
  })

  it('đọc FAQ dạng danh sách có câu hỏi in đậm và câu trả lời', () => {
    const result = parseFaqsResult(
      '<ul><li><strong>Mũ có Pinlock không?</strong><p>Có, kèm Pinlock 70.</p></li></ul>',
    )
    expect(result.items).toEqual([
      { question: 'Mũ có Pinlock không?', answer: '<p>Có, kèm Pinlock 70.</p>' },
    ])
    expect(result.acceptedCount).toBe(1)
  })

  it('HTML không đọc được không tạo ra danh sách rỗng hợp lệ', () => {
    const result = parseFaqsResult('<div>Chỉ có bố cục riêng</div>')
    expect(result.acceptedCount).toBe(0)
    expect(result.hasInput).toBe(true)
  })
})

describe('mergeFaqsHtmlIntoItems', () => {
  it('tab tiếng Việt thêm/bớt FAQ qua HTML và giữ bản tiếng Anh theo vị trí', () => {
    const items = [
      faq('Cũ 1', '<p>Trả lời cũ 1</p>', 'Old 1', '<p>Old answer 1</p>', 'first'),
      faq('Cũ 2', '<p>Trả lời cũ 2</p>', 'Old 2', '<p>Old answer 2</p>', 'second'),
    ]
    const html = [
      '<div class="bb-faq-item"><h4 class="bb-faq-question">Mới 1</h4><div class="bb-faq-answer"><p>Đáp 1</p></div></div>',
      '<div class="bb-faq-item"><h4 class="bb-faq-question">Mới 2</h4><div class="bb-faq-answer"><p>Đáp 2</p></div></div>',
      '<div class="bb-faq-item"><h4 class="bb-faq-question">Mới 3</h4><div class="bb-faq-answer"><p>Đáp 3</p></div></div>',
    ].join('')

    const next = mergeFaqsHtmlIntoItems(items, html, false)

    expect(next).toHaveLength(3)
    expect(next.map(({ question, answer }) => ({ question, answer }))).toEqual([
      { question: 'Mới 1', answer: '<p>Đáp 1</p>' },
      { question: 'Mới 2', answer: '<p>Đáp 2</p>' },
      { question: 'Mới 3', answer: '<p>Đáp 3</p>' },
    ])
    expect(next.map((item) => item.questionEn)).toEqual(['Old 1', 'Old 2', ''])
    expect(next.map((item) => item.answerEn)).toEqual([
      '<p>Old answer 1</p>',
      '<p>Old answer 2</p>',
      '',
    ])
    expect(next.slice(0, 2).map((item) => item._key)).toEqual(['first', 'second'])
  })

  it('tab tiếng Anh chỉ sửa questionEn/answerEn theo vị trí, không đổi số FAQ', () => {
    const items = [
      faq('VI 1', '<p>Đáp VI 1</p>', 'Old 1', '<p>Old answer 1</p>', 'first'),
      faq('VI 2', '<p>Đáp VI 2</p>', 'Old 2', '<p>Old answer 2</p>', 'second'),
    ]
    const html = [
      '<div class="bb-faq-item"><h4 class="bb-faq-question">New 1</h4><div class="bb-faq-answer"><p>New answer 1</p></div></div>',
      '<div class="bb-faq-item"><h4 class="bb-faq-question">New 2</h4><div class="bb-faq-answer"><p>New answer 2</p></div></div>',
      '<div class="bb-faq-item"><h4 class="bb-faq-question">Ignored 3</h4><div class="bb-faq-answer"><p>Ignored answer 3</p></div></div>',
    ].join('')

    const next = mergeFaqsHtmlIntoItems(items, html, true)

    expect(next).toHaveLength(2)
    expect(next.map((item) => item.question)).toEqual(['VI 1', 'VI 2'])
    expect(next.map((item) => item.answer)).toEqual(['<p>Đáp VI 1</p>', '<p>Đáp VI 2</p>'])
    expect(next.map((item) => item.questionEn)).toEqual(['New 1', 'New 2'])
    expect(next.map((item) => item.answerEn)).toEqual([
      '<p>New answer 1</p>',
      '<p>New answer 2</p>',
    ])
  })

  it('HTML không đọc được giữ nguyên FAQ hiện có', () => {
    const items = [faq('Câu hỏi cũ', '<p>Đáp án cũ</p>', '', '', 'old')]
    expect(mergeFaqsHtmlIntoItems(items, '<div>không theo mẫu</div>')).toEqual(items)
  })
})
