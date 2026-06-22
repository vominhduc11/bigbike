import { describe, it, expect } from 'vitest'
import {
  parseSuitabilityCards,
  serializeSuitabilityCards,
  mergeSuitabilityIntoHtml,
  emptySuitabilityCard,
} from './suitabilityCards'

const card = (audience, advice, linkLabel = '', linkUrl = '') => ({ audience, advice, linkLabel, linkUrl })

describe('serializeSuitabilityCards', () => {
  it('rỗng / chỉ thẻ trống → chuỗi rỗng', () => {
    expect(serializeSuitabilityCards(null)).toBe('')
    expect(serializeSuitabilityCards([])).toBe('')
    expect(serializeSuitabilityCards([emptySuitabilityCard()])).toBe('')
  })

  it('xuất <li> với đối tượng (đậm) → lời khuyên', () => {
    const html = serializeSuitabilityCards([card('Touring đường dài', 'Trọng lượng nhẹ phát huy tốt.')])
    expect(html).toContain('<ul class="suitability-list">')
    expect(html).toContain('<strong>Touring đường dài</strong> → Trọng lượng nhẹ phát huy tốt.')
  })

  it('có link → thêm <a href>', () => {
    const html = serializeSuitabilityCards([card('Người mới', 'Chọn cỡ M.', 'Xem hướng dẫn', '/huong-dan')])
    expect(html).toContain('<a href="/huong-dan">Xem hướng dẫn</a>')
  })

  it('link thiếu nhãn HOẶC url → bỏ link', () => {
    expect(serializeSuitabilityCards([card('A', 'B', 'Nhãn', '')])).not.toContain('<a')
    expect(serializeSuitabilityCards([card('A', 'B', '', '/x')])).not.toContain('<a')
  })

  it('escape ký tự HTML', () => {
    const html = serializeSuitabilityCards([card('<b>x</b> & y', 'z')])
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y')
    expect(html).not.toContain('<b>x</b>')
  })
})

describe('parseSuitabilityCards', () => {
  it('rỗng → mảng rỗng', () => {
    expect(parseSuitabilityCards('')).toEqual([])
    expect(parseSuitabilityCards(null)).toEqual([])
  })

  it('round-trip giữ nguyên đối tượng / lời khuyên / link', () => {
    const cards = [
      card('Touring đường dài', 'Trọng lượng nhẹ phát huy tốt.', 'Xem hướng dẫn', '/huong-dan'),
      card('Đi phố hằng ngày', 'Ưu tiên thoáng khí, gọn nhẹ.'),
    ]
    const parsed = parseSuitabilityCards(serializeSuitabilityCards(cards))
    expect(parsed).toEqual(cards)
  })

  it('round-trip thẻ chỉ có đối tượng', () => {
    const cards = [card('Chỉ đối tượng', '')]
    expect(parseSuitabilityCards(serializeSuitabilityCards(cards))).toEqual(cards)
  })

  it('đọc được HTML tự do dạng <p><strong>…</strong> → …</p>', () => {
    const parsed = parseSuitabilityCards('<p><strong>Người mới</strong> → Nên chọn cỡ M</p>')
    expect(parsed).toEqual([card('Người mới', 'Nên chọn cỡ M')])
  })

  it('bỏ qua thẻ rỗng nội dung', () => {
    expect(parseSuitabilityCards('<ul><li></li><li><strong>A</strong></li></ul>')).toEqual([card('A', '')])
  })
})

describe('mergeSuitabilityIntoHtml', () => {
  it('html trống → sinh mặc định', () => {
    const cards = [card('A', 'B')]
    expect(mergeSuitabilityIntoHtml(cards, '')).toBe(serializeSuitabilityCards(cards))
  })

  it('GIỮ NGUYÊN style/class khung thẻ, chỉ dựng lại nội dung', () => {
    const styled =
      '<ul class="cards" style="gap:8px"><li style="background:#eee"><strong>Cũ</strong> → lời cũ</li></ul>'
    const out = mergeSuitabilityIntoHtml([card('Mới', 'lời mới')], styled)
    expect(out).toContain('class="cards"')
    expect(out).toContain('style="gap:8px"')
    expect(out).toContain('style="background:#eee"')
    expect(out).toContain('<strong>Mới</strong>')
    expect(out).toContain('lời mới')
    expect(out).not.toContain('Cũ')
  })

  it('thêm thẻ → nhân bản giữ style thẻ cuối', () => {
    const styled = '<ul><li style="color:red"><strong>A</strong> → a</li></ul>'
    const out = mergeSuitabilityIntoHtml([card('A', 'a'), card('B', 'b')], styled)
    expect(out).toContain('<strong>B</strong>')
    expect((out.match(/style="color:red"/g) || []).length).toBe(2)
  })

  it('bớt thẻ → gỡ node thừa', () => {
    const styled = '<ul><li><strong>A</strong></li><li><strong>B</strong></li></ul>'
    const out = mergeSuitabilityIntoHtml([card('A', '')], styled)
    expect(out).toContain('A')
    expect(out).not.toContain('B')
  })
})
