import { describe, it, expect } from 'vitest'
import {
  parseSuitabilityCards,
  serializeSuitabilityCards,
  mergeSuitabilityIntoHtml,
  emptySuitabilityCard,
  parseSuitabilityResult,
} from './suitabilityCards'

const card = (audience, advice) => ({ audience, advice })

describe('serializeSuitabilityCards', () => {
  it('rỗng / chỉ thẻ trống → chuỗi rỗng', () => {
    expect(serializeSuitabilityCards(null)).toBe('')
    expect(serializeSuitabilityCards([])).toBe('')
    expect(serializeSuitabilityCards([emptySuitabilityCard()])).toBe('')
  })

  it('xuất <li> với đối tượng (đậm) → lời khuyên', () => {
    const html = serializeSuitabilityCards([
      card('Touring đường dài', 'Trọng lượng nhẹ phát huy tốt.'),
    ])
    expect(html).toContain(
      '<ul class="suitability-list" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;',
    )
    expect(html).toContain(
      '<li style="margin:0;"><strong style="color:var(--bb-text-primary);font-weight:700;">Touring đường dài</strong> → Trọng lượng nhẹ phát huy tốt.</li>',
    )
  })

  it('giữ inline HTML an toàn ở tên và escape lời khuyên', () => {
    const html = serializeSuitabilityCards([card('<b>x</b> & y', '<i>z</i>')])
    expect(html).toContain(
      '<strong style="color:var(--bb-text-primary);font-weight:700;"><b>x</b> &amp; y</strong>',
    )
    expect(html).toContain('&lt;i&gt;z&lt;/i&gt;')
  })
})

describe('parseSuitabilityCards', () => {
  it('rỗng → mảng rỗng', () => {
    expect(parseSuitabilityCards('')).toEqual([])
    expect(parseSuitabilityCards(null)).toEqual([])
  })

  it('round-trip giữ nguyên đối tượng / lời khuyên', () => {
    const cards = [
      card('Touring đường dài', 'Trọng lượng nhẹ phát huy tốt.'),
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

  it('đọc và giữ inline đậm/nghiêng trong tên đối tượng', () => {
    const parsed = parseSuitabilityCards(
      '<ul><li><strong style="color:var(--bb-text-primary);font-weight:700;">Người <em>mới</em></strong> → Nên chọn cỡ M</li></ul>',
    )
    expect(parsed).toEqual([card('Người <em>mới</em>', 'Nên chọn cỡ M')])
  })

  it('đọc HTML thông thường dạng tiêu đề + đoạn văn', () => {
    expect(parseSuitabilityResult('<h3>Người mới</h3><p>Nên chọn cỡ M</p>').items).toEqual([
      card('Người mới', 'Nên chọn cỡ M'),
    ])
  })

  it('bỏ qua thẻ rỗng nội dung', () => {
    expect(parseSuitabilityCards('<ul><li></li><li><strong>A</strong></li></ul>')).toEqual([
      card('A', ''),
    ])
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

  it('sửa thẻ không làm mất style khung hoặc inline đậm/nghiêng của tên', () => {
    const existing =
      '<ul class="suitability-list" style="list-style:none;"><li style="margin:0;"><strong style="color:var(--bb-text-primary);font-weight:700;">Người <em>cũ</em></strong> → Lời cũ</li></ul>'
    const out = mergeSuitabilityIntoHtml([card('Người <em>mới</em>', 'Lời mới')], existing)
    expect(out).toContain('class="suitability-list"')
    expect(out).toContain('style="color:var(--bb-text-primary);font-weight:700;"')
    expect(out).toContain('Người <em>mới</em>')
    expect(out).toContain('Lời mới')
  })
})
