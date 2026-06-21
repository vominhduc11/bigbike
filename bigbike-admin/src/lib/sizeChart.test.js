import { describe, it, expect } from 'vitest'
import { parseSizeGuide, serializeSizeGuide, emptySizeGuide, SIZE_COL2_DEFAULT } from './sizeChart'

const cols = (...labels) => labels.map((label) => ({ _key: label, label }))
const row = (...cells) => ({ _key: cells.join('|'), cells })

describe('serializeSizeGuide', () => {
  it('rỗng → chuỗi rỗng', () => {
    expect(serializeSizeGuide(null)).toBe('')
    expect(serializeSizeGuide({ columns: cols('Size', 'X'), rows: [], note: '' })).toBe('')
    expect(serializeSizeGuide({ columns: cols('Size', 'X'), rows: [row('', '')] })).toBe('')
  })

  it('xuất <table> với header + dòng', () => {
    const html = serializeSizeGuide({
      columns: cols('Size', 'Vòng đầu (cm)'),
      rows: [row('M', '57 – 58'), row('L', '59 – 60')],
      note: '',
    })
    expect(html).toContain('<table>')
    expect(html).toContain('<th>Size</th><th>Vòng đầu (cm)</th>')
    expect(html).toContain('<td>M</td><td>57 – 58</td>')
    expect(html).toContain('<td>L</td><td>59 – 60</td>')
    expect(html).not.toContain('<p>')
  })

  it('có note → thêm <p>', () => {
    const html = serializeSizeGuide({
      columns: cols('Size', 'Vòng đầu (cm)'),
      rows: [row('M', '57')],
      note: 'Chọn size lớn hơn',
    })
    expect(html).toContain('<p>Chọn size lớn hơn</p>')
  })

  it('escape ký tự HTML', () => {
    const html = serializeSizeGuide({ columns: cols('Size', 'X'), rows: [row('M', '<b>x</b> & y')] })
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y')
    expect(html).not.toContain('<b>x</b>')
  })

  it('số cột linh hoạt — xuất đúng số cột (5 cột)', () => {
    const html = serializeSizeGuide({
      columns: cols('Size', 'Vòng đầu', 'Vòng ngực', 'Chiều cao', 'Cân nặng'),
      rows: [row('M', '57', '90', '165', '60')],
    })
    expect(html).toContain('<th>Size</th><th>Vòng đầu</th><th>Vòng ngực</th><th>Chiều cao</th><th>Cân nặng</th>')
    expect(html).toContain('<td>M</td><td>57</td><td>90</td><td>165</td><td>60</td>')
  })

  it('ô thiếu trong dòng → bù <td> rỗng cho đủ số cột', () => {
    const html = serializeSizeGuide({
      columns: cols('Size', 'A', 'B'),
      rows: [{ _key: 'r', cells: ['M', '1'] }],
    })
    expect(html).toContain('<td>M</td><td>1</td><td></td>')
  })
})

describe('parseSizeGuide', () => {
  it('rỗng → model mặc định 2 cột', () => {
    const parsed = parseSizeGuide('')
    expect(parsed.columns.map((c) => c.label)).toEqual(['Size', SIZE_COL2_DEFAULT])
    expect(parsed.rows).toEqual([])
    expect(parsed.note).toBe('')
  })

  it('round-trip nhiều cột giữ nguyên dữ liệu', () => {
    const model = {
      columns: cols('Size', 'Vòng đầu (cm)', 'Kích cỡ vỏ', 'Ghi chú'),
      rows: [row('M', '57 – 58', 'Shell nhỏ (XS–M)', 'Bán chạy nhất')],
      note: '',
    }
    const parsed = parseSizeGuide(serializeSizeGuide(model))
    expect(parsed.columns.map((c) => c.label)).toEqual(['Size', 'Vòng đầu (cm)', 'Kích cỡ vỏ', 'Ghi chú'])
    expect(parsed.rows.map((r) => r.cells)).toEqual([['M', '57 – 58', 'Shell nhỏ (XS–M)', 'Bán chạy nhất']])
    expect(parsed.rows.every((r) => r._key)).toBe(true)
  })

  it('round-trip 2 cột + note', () => {
    const model = {
      columns: cols('Size', 'Vòng ngực (cm)'),
      rows: [row('M', '88 – 92'), row('L', '96 – 100')],
      note: 'Đo nơi rộng nhất.',
    }
    const parsed = parseSizeGuide(serializeSizeGuide(model))
    expect(parsed.columns.map((c) => c.label)).toEqual(['Size', 'Vòng ngực (cm)'])
    expect(parsed.rows.map((r) => r.cells)).toEqual([['M', '88 – 92'], ['L', '96 – 100']])
    expect(parsed.note).toBe('Đo nơi rộng nhất.')
  })

  it('fallback: văn bản thuần kiểu "- M: 57-58 cm" → tách thành dòng + ghi chú', () => {
    const legacy = 'Đo chu vi vòng đầu (cm) tại vị trí lớn nhất, rồi đối chiếu:\n- M: 57-58 cm\n- L: 59-60 cm\n- XL: 61-62 cm\nNếu số đo nằm giữa hai size, nên chọn size lớn hơn.'
    const parsed = parseSizeGuide(legacy)
    expect(parsed.rows.map((r) => r.cells)).toEqual([
      ['M', '57-58 cm'],
      ['L', '59-60 cm'],
      ['XL', '61-62 cm'],
    ])
    expect(parsed.note).toContain('Đo chu vi vòng đầu')
    expect(parsed.note).toContain('Nếu số đo nằm giữa hai size')
  })

  it('emptySizeGuide có _key duy nhất cho mỗi cột', () => {
    const e = emptySizeGuide()
    expect(e.columns).toHaveLength(2)
    expect(e.columns[0]._key).not.toBe(e.columns[1]._key)
  })
})
