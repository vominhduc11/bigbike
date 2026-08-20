import { describe, expect, it } from 'vitest'
import {
  mergeHighlightsHtmlIntoItems,
  mergeHighlightsPairHtmlIntoItems,
  parseHighlightsPairResult,
  parseHighlightsFromHtml,
  parseHighlightsPairFromHtml,
  serializeHighlightsPairToHtml,
  serializeHighlightsToHtml,
} from './highlightsBlock'

describe('serializeHighlightsToHtml / parseHighlightsFromHtml', () => {
  it('round-trip giữ nội dung từng mục', () => {
    const items = [
      { _key: 'a', content: 'Nhẹ hơn LS2 Storm II 29g.' },
      { _key: 'b', content: 'Chống trầy tốt.' },
    ]

    const html = serializeHighlightsToHtml(items, false)
    expect(html).toContain('class="bb-highlights-list"')
    expect(parseHighlightsFromHtml(html)).toEqual(items.map((item) => item.content))
  })

  it('rỗng khi không có mục nào có nội dung', () => {
    expect(serializeHighlightsToHtml([{ content: '' }, { content: '   ' }], false)).toBe('')
    expect(parseHighlightsFromHtml('')).toEqual([])
  })
})

describe('mergeHighlightsHtmlIntoItems', () => {
  it('tab tiếng Việt thêm/bớt mục qua HTML và giữ bản tiếng Anh theo vị trí', () => {
    const items = [
      { _key: 'first', content: 'Cũ 1', contentEn: 'Old 1' },
      { _key: 'second', content: 'Cũ 2', contentEn: 'Old 2' },
    ]
    const html = '<ul class="bb-highlights-list"><li>Mới 1</li><li>Mới 2</li><li>Mới 3</li></ul>'

    const next = mergeHighlightsHtmlIntoItems(items, html, false)

    expect(next).toHaveLength(3)
    expect(next.map((item) => item.content)).toEqual(['Mới 1', 'Mới 2', 'Mới 3'])
    expect(next.map((item) => item.contentEn)).toEqual(['Old 1', 'Old 2', ''])
    expect(next.slice(0, 2).map((item) => item._key)).toEqual(['first', 'second'])
  })

  it('tab tiếng Anh chỉ sửa contentEn theo vị trí, không đổi số mục', () => {
    const items = [
      { _key: 'first', content: 'VI 1', contentEn: 'Old 1' },
      { _key: 'second', content: 'VI 2', contentEn: 'Old 2' },
    ]
    const html =
      '<ul class="bb-highlights-list"><li>New 1</li><li>New 2</li><li>Ignored 3</li></ul>'

    const next = mergeHighlightsHtmlIntoItems(items, html, true)

    expect(next).toHaveLength(2)
    expect(next.map((item) => item.content)).toEqual(['VI 1', 'VI 2'])
    expect(next.map((item) => item.contentEn)).toEqual(['New 1', 'New 2'])
  })
})

describe('serializeHighlightsPairToHtml / parseHighlightsPairFromHtml', () => {
  it('gộp ưu điểm và nhược điểm vào 1 khối, phân biệt bằng 2 vùng pros/cons', () => {
    const positiveNotes = [{ content: 'Nhẹ' }, { content: 'Bền' }]
    const negativeNotes = [{ content: 'Không kèm Pinlock' }]

    const html = serializeHighlightsPairToHtml(positiveNotes, negativeNotes, false, {
      prosLabel: 'Ưu điểm',
      consLabel: 'Nhược điểm',
    })

    expect(html).toContain('class="bb-highlights-pros"')
    expect(html).toContain('class="bb-highlights-cons"')
    expect(parseHighlightsPairFromHtml(html)).toEqual({
      positive: ['Nhẹ', 'Bền'],
      negative: ['Không kèm Pinlock'],
    })
  })

  it('rỗng khi cả 2 bên đều không có nội dung', () => {
    expect(serializeHighlightsPairToHtml([], [], false)).toBe('')
    expect(parseHighlightsPairFromHtml('')).toEqual({ positive: [], negative: [] })
  })

  it('đọc danh sách không gắn nhãn vào Ưu điểm theo rule owner', () => {
    const result = parseHighlightsPairResult(
      '<h4>Điểm nổi bật</h4><ul><li>Nhẹ</li><li>Thoáng</li></ul>',
    )
    expect(result.positive).toEqual(['Nhẹ', 'Thoáng'])
    expect(result.negative).toEqual([])
    expect(result.presentGroups).toEqual({ positive: true, negative: false })
  })
})

describe('mergeHighlightsPairHtmlIntoItems', () => {
  it('tab tiếng Việt: 1 khối mã cập nhật cả 2 mảng cùng lúc', () => {
    const positiveNotes = [{ _key: 'p1', content: 'Cũ ưu 1', contentEn: 'Old pro 1' }]
    const negativeNotes = [{ _key: 'n1', content: 'Cũ nhược 1', contentEn: 'Old con 1' }]
    const html = [
      '<div class="bb-highlights-pros"><h4>Ưu điểm</h4><ul class="bb-highlights-list"><li>Mới ưu 1</li><li>Mới ưu 2</li></ul></div>',
      '<div class="bb-highlights-cons"><h4>Nhược điểm</h4><ul class="bb-highlights-list"><li>Mới nhược 1</li></ul></div>',
    ].join('')

    const next = mergeHighlightsPairHtmlIntoItems(positiveNotes, negativeNotes, html, false)

    expect(next.positiveNotes.map((item) => item.content)).toEqual(['Mới ưu 1', 'Mới ưu 2'])
    expect(next.positiveNotes[0]._key).toBe('p1')
    expect(next.positiveNotes[0].contentEn).toBe('Old pro 1')
    expect(next.negativeNotes.map((item) => item.content)).toEqual(['Mới nhược 1'])
    expect(next.negativeNotes[0]._key).toBe('n1')
  })

  it('tab tiếng Anh: chỉ sửa contentEn theo vị trí ở cả 2 bên, không đổi số mục', () => {
    const positiveNotes = [{ _key: 'p1', content: 'VI ưu 1', contentEn: 'Old pro 1' }]
    const negativeNotes = [{ _key: 'n1', content: 'VI nhược 1', contentEn: 'Old con 1' }]
    const html = [
      '<div class="bb-highlights-pros"><ul class="bb-highlights-list"><li>New pro 1</li></ul></div>',
      '<div class="bb-highlights-cons"><ul class="bb-highlights-list"><li>New con 1</li></ul></div>',
    ].join('')

    const next = mergeHighlightsPairHtmlIntoItems(positiveNotes, negativeNotes, html, true)

    expect(next.positiveNotes).toHaveLength(1)
    expect(next.positiveNotes[0].content).toBe('VI ưu 1')
    expect(next.positiveNotes[0].contentEn).toBe('New pro 1')
    expect(next.negativeNotes[0].contentEn).toBe('New con 1')
  })

  it('HTML không đọc được giữ nguyên cả hai nhóm', () => {
    const positive = [{ _key: 'p1', content: 'Ưu cũ', contentEn: '' }]
    const negative = [{ _key: 'n1', content: 'Nhược cũ', contentEn: '' }]
    expect(
      mergeHighlightsPairHtmlIntoItems(positive, negative, '<div>không theo mẫu</div>', false),
    ).toEqual({
      positiveNotes: positive,
      negativeNotes: negative,
    })
  })
})
