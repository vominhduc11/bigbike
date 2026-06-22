import { describe, it, expect } from 'vitest'
import { serializeSpecs, parseSpecsFromHtml, mergeSpecsIntoHtml } from './specSheet'

const spec = (name, value) => ({ name, value })

describe('serializeSpecs', () => {
  it('rỗng / dòng trống → chuỗi rỗng', () => {
    expect(serializeSpecs(null)).toBe('')
    expect(serializeSpecs([])).toBe('')
    expect(serializeSpecs([spec('', '')])).toBe('')
  })

  it('xuất table.shop_attributes với <th> tên + <td> giá trị', () => {
    const html = serializeSpecs([spec('Chất liệu', 'Sợi carbon'), spec('Trọng lượng', '1.4 kg')])
    expect(html).toContain('<table class="shop_attributes">')
    expect(html).toContain('<th scope="row">Chất liệu</th><td>Sợi carbon</td>')
    expect(html).toContain('<th scope="row">Trọng lượng</th><td>1.4 kg</td>')
  })

  it('escape ký tự HTML', () => {
    const html = serializeSpecs([spec('<b>x</b>', '& y')])
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('&amp; y')
    expect(html).not.toContain('<b>x</b>')
  })
})

describe('parseSpecsFromHtml', () => {
  it('rỗng → mảng rỗng', () => {
    expect(parseSpecsFromHtml('')).toEqual([])
    expect(parseSpecsFromHtml(null)).toEqual([])
  })

  it('round-trip giữ nguyên tên/giá trị', () => {
    const rows = [spec('Chất liệu', 'Sợi carbon'), spec('Trọng lượng', '1.4 kg')]
    const parsed = parseSpecsFromHtml(serializeSpecs(rows))
    expect(parsed.map((r) => ({ name: r.name, value: r.value }))).toEqual(rows)
    expect(parsed.every((r) => r._key)).toBe(true)
  })

  it('đọc bảng tùy biến (có style) bỏ qua CSS, lấy chữ', () => {
    const html =
      '<table style="border:1px solid"><tbody><tr><th style="color:red">Size</th><td>M</td></tr></tbody></table>'
    expect(parseSpecsFromHtml(html).map((r) => ({ name: r.name, value: r.value }))).toEqual([spec('Size', 'M')])
  })

  it('fallback text "tên: giá trị"', () => {
    expect(parseSpecsFromHtml('Chất liệu: Carbon\nTrọng lượng: 1.4 kg').map((r) => ({ name: r.name, value: r.value })))
      .toEqual([spec('Chất liệu', 'Carbon'), spec('Trọng lượng', '1.4 kg')])
  })
})

describe('mergeSpecsIntoHtml', () => {
  it('html trống → sinh mặc định', () => {
    const rows = [spec('A', 'B')]
    expect(mergeSpecsIntoHtml(rows, '')).toBe(serializeSpecs(rows))
  })

  it('GIỮ NGUYÊN style/class, chỉ đổi text', () => {
    const styled =
      '<table class="specs" style="width:100%"><tbody><tr><th scope="row" style="color:blue">Chất liệu</th><td>Cũ</td></tr></tbody></table>'
    const out = mergeSpecsIntoHtml([spec('Chất liệu', 'Mới')], styled)
    expect(out).toContain('class="specs"')
    expect(out).toContain('style="width:100%"')
    expect(out).toContain('style="color:blue"')
    expect(out).toContain('Mới')
    expect(out).not.toContain('Cũ')
  })

  it('thêm dòng → nhân bản giữ style dòng cuối', () => {
    const styled =
      '<table><tbody><tr><th scope="row" style="padding:2px">A</th><td>1</td></tr></tbody></table>'
    const out = mergeSpecsIntoHtml([spec('A', '1'), spec('B', '2')], styled)
    expect(out).toContain('B')
    expect(out).toContain('2')
    expect((out.match(/style="padding:2px"/g) || []).length).toBe(2)
  })

  it('bớt dòng → gỡ node thừa', () => {
    const styled = '<table><tbody><tr><th scope="row">A</th><td>1</td></tr><tr><th scope="row">B</th><td>2</td></tr></tbody></table>'
    const out = mergeSpecsIntoHtml([spec('A', '1')], styled)
    expect(out).toContain('>A<')
    expect(out).not.toContain('>B<')
  })

  it('không còn dòng → gỡ bảng', () => {
    const styled = '<table><tbody><tr><th scope="row">A</th><td>1</td></tr></tbody></table>'
    expect(mergeSpecsIntoHtml([], styled)).toBe('')
  })
})
