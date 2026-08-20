import { describe, it, expect } from 'vitest'
import {
  parseSizeGuide,
  parseSizeGuideResult,
  serializeSizeGuide,
  mergeSizeGuideIntoHtml,
  emptySizeGuide,
  SIZE_COL2_DEFAULT,
} from './sizeChart'

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
    expect(html).toMatch(/^<table style="[^"]+">/)
    expect(html).toMatch(/<th style="[^"]+">Size<\/th><th style="[^"]+">Vòng đầu \(cm\)<\/th>/)
    expect(html).toMatch(/<td style="[^"]+">M<\/td><td style="[^"]+">57 – 58<\/td>/)
    expect(html).toMatch(/<td style="[^"]+">L<\/td><td style="[^"]+">59 – 60<\/td>/)
    expect(html).not.toContain('<p ')
  })

  it('có note → thêm <p> với style riêng, bọc <em>', () => {
    const html = serializeSizeGuide({
      columns: cols('Size', 'Vòng đầu (cm)'),
      rows: [row('M', '57')],
      note: 'Chọn size lớn hơn',
    })
    expect(html).toMatch(/<p style="[^"]+"><em>Chọn size lớn hơn<\/em><\/p>$/)
  })

  it('cột đầu tiên (size) có font-weight:700, cột sau thì không', () => {
    const html = serializeSizeGuide({
      columns: cols('Size', 'X'),
      rows: [row('M', '57')],
    })
    const [, firstTd, secondTd] = html.match(
      /<td style="([^"]+)">M<\/td><td style="([^"]+)">57<\/td>/,
    )
    expect(firstTd).toContain('font-weight:700')
    expect(secondTd).not.toContain('font-weight:700')
  })

  it('dùng token web, không hardcode font/màu/cỡ chữ', () => {
    const html = serializeSizeGuide({ columns: cols('Size', 'Vòng đầu'), rows: [row('M', '57')] })
    expect(html).toContain('font-family:var(--bb-font-body)')
    expect(html).toContain('font-size:var(--bb-text-a4-content)')
    expect(html).toContain('color:var(--bb-text-primary)')
    expect(html).not.toContain('Arial')
    expect(html).not.toContain('#dddddd')
    expect(html).not.toContain('font-size:16px')
  })

  it('escape ký tự HTML', () => {
    const html = serializeSizeGuide({
      columns: cols('Size', 'X'),
      rows: [row('M', '<b>x</b> & y')],
    })
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y')
    expect(html).not.toContain('<b>x</b>')
  })

  it('số cột linh hoạt — xuất đúng số cột (5 cột)', () => {
    const html = serializeSizeGuide({
      columns: cols('Size', 'Vòng đầu', 'Vòng ngực', 'Chiều cao', 'Cân nặng'),
      rows: [row('M', '57', '90', '165', '60')],
    })
    expect(html).toMatch(
      /<th style="[^"]+">Size<\/th><th style="[^"]+">Vòng đầu<\/th><th style="[^"]+">Vòng ngực<\/th><th style="[^"]+">Chiều cao<\/th><th style="[^"]+">Cân nặng<\/th>/,
    )
    expect(html).toMatch(
      /<td style="[^"]+">M<\/td><td style="[^"]+">57<\/td><td style="[^"]+">90<\/td><td style="[^"]+">165<\/td><td style="[^"]+">60<\/td>/,
    )
  })

  it('ô thiếu trong dòng → bù <td> rỗng cho đủ số cột', () => {
    const html = serializeSizeGuide({
      columns: cols('Size', 'A', 'B'),
      rows: [{ _key: 'r', cells: ['M', '1'] }],
    })
    expect(html).toMatch(
      /<td style="[^"]+">M<\/td><td style="[^"]+">1<\/td><td style="[^"]+"><\/td>/,
    )
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
    expect(parsed.columns.map((c) => c.label)).toEqual([
      'Size',
      'Vòng đầu (cm)',
      'Kích cỡ vỏ',
      'Ghi chú',
    ])
    expect(parsed.rows.map((r) => r.cells)).toEqual([
      ['M', '57 – 58', 'Shell nhỏ (XS–M)', 'Bán chạy nhất'],
    ])
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
    expect(parsed.rows.map((r) => r.cells)).toEqual([
      ['M', '88 – 92'],
      ['L', '96 – 100'],
    ])
    expect(parsed.note).toBe('Đo nơi rộng nhất.')
  })

  it('nhận bảng AI dùng token và thead/tbody chuẩn', () => {
    const html =
      '<table style="font-family:var(--bb-font-body);font-size:var(--bb-text-a4-content);color:var(--bb-text-primary)"><thead><tr><th>Size</th><th>Vòng đầu</th></tr></thead><tbody><tr><td>M</td><td>57–58</td></tr></tbody></table>'
    const result = parseSizeGuideResult(html)
    expect(result.acceptedCount).toBe(1)
    expect(result.model.columns.map((c) => c.label)).toEqual(['Size', 'Vòng đầu'])
    expect(result.model.rows[0].cells).toEqual(['M', '57–58'])
  })

  it('nhận bảng có thead nhưng không có tbody', () => {
    const result = parseSizeGuideResult(
      '<table><thead><tr><th>Size</th><th>Vòng đầu</th></tr></thead><tr><td>M</td><td>57–58</td></tr></table>',
    )
    expect(result.acceptedCount).toBe(1)
    expect(result.model.rows[0].cells).toEqual(['M', '57–58'])
  })

  it('fallback: văn bản thuần kiểu "- M: 57-58 cm" → tách thành dòng + ghi chú', () => {
    const legacy =
      'Đo chu vi vòng đầu (cm) tại vị trí lớn nhất, rồi đối chiếu:\n- M: 57-58 cm\n- L: 59-60 cm\n- XL: 61-62 cm\nNếu số đo nằm giữa hai size, nên chọn size lớn hơn.'
    const parsed = parseSizeGuide(legacy)
    expect(parsed.rows.map((r) => r.cells)).toEqual([
      ['M', '57-58 cm'],
      ['L', '59-60 cm'],
      ['XL', '61-62 cm'],
    ])
    expect(parsed.note).toContain('Đo chu vi vòng đầu')
    expect(parsed.note).toContain('Nếu số đo nằm giữa hai size')
  })

  it('đọc HTML thông thường dạng size ở tiêu đề + số đo ở đoạn văn', () => {
    const result = parseSizeGuideResult('<h3>M</h3><p>57–58 cm</p><h3>L</h3><p>59–60 cm</p>')
    expect(result.model.rows.map((item) => item.cells)).toEqual([
      ['M', '57–58 cm'],
      ['L', '59–60 cm'],
    ])
  })

  it('đọc bảng size dạng danh sách gạch đầu dòng', () => {
    const result = parseSizeGuide('<ul><li>Small: 54–55 cm</li><li>Large - 58–59 cm</li></ul>')
    expect(result.rows.map((row) => row.cells)).toEqual([
      ['Small', '54–55 cm'],
      ['Large', '58–59 cm'],
    ])
  })

  it('emptySizeGuide có _key duy nhất cho mỗi cột', () => {
    const e = emptySizeGuide()
    expect(e.columns).toHaveLength(2)
    expect(e.columns[0]._key).not.toBe(e.columns[1]._key)
  })
})

describe('mergeSizeGuideIntoHtml', () => {
  it('html trống → sinh mặc định như serializeSizeGuide', () => {
    const model = { columns: cols('Size', 'X'), rows: [row('M', '57')], note: '' }
    expect(mergeSizeGuideIntoHtml(model, '')).toBe(serializeSizeGuide(model))
  })

  it('GIỮ NGUYÊN style/class, chỉ đổi text', () => {
    const styled =
      '<table style="border:1px solid red" class="size-tbl"><thead><tr><th style="color:blue">Size</th><th>Vòng đầu</th></tr></thead><tbody><tr><td>M</td><td>57</td></tr></tbody></table>'
    const model = { columns: cols('Cỡ', 'Vòng đầu (cm)'), rows: [row('M', '58')], note: '' }
    const out = mergeSizeGuideIntoHtml(model, styled)
    expect(out).toContain('style="border:1px solid red"')
    expect(out).toContain('class="size-tbl"')
    expect(out).toContain('style="color:blue"')
    expect(out).toContain('Cỡ')
    expect(out).toContain('58')
    expect(out).not.toContain('>57<')
  })

  it('thêm dòng → nhân bản giữ style của dòng cuối', () => {
    const styled =
      '<table><thead><tr><th>Size</th><th>Vòng đầu</th></tr></thead><tbody><tr class="r"><td style="padding:4px">M</td><td>57</td></tr></tbody></table>'
    const model = {
      columns: cols('Size', 'Vòng đầu'),
      rows: [row('M', '57'), row('L', '59')],
      note: '',
    }
    const out = mergeSizeGuideIntoHtml(model, styled)
    expect(out).toContain('L')
    expect(out).toContain('59')
    // dòng mới kế thừa style ô của dòng cuối
    expect((out.match(/style="padding:4px"/g) || []).length).toBe(2)
  })

  it('bớt dòng → gỡ node thừa', () => {
    const styled =
      '<table><thead><tr><th>Size</th><th>X</th></tr></thead><tbody><tr><td>M</td><td>1</td></tr><tr><td>L</td><td>2</td></tr></tbody></table>'
    const model = { columns: cols('Size', 'X'), rows: [row('M', '1')], note: '' }
    const out = mergeSizeGuideIntoHtml(model, styled)
    expect(out).toContain('>M<')
    expect(out).not.toContain('>L<')
  })

  it('bảng hết nội dung → gỡ bảng, giữ/đặt ghi chú', () => {
    const styled =
      '<table><thead><tr><th>Size</th></tr></thead><tbody><tr><td>M</td></tr></tbody></table>'
    const out = mergeSizeGuideIntoHtml({ columns: cols('Size'), rows: [], note: 'Ghi chú' }, styled)
    expect(out).not.toContain('<table')
    expect(out).toContain('Ghi chú')
  })

  it('html không phải bảng → sinh mặc định', () => {
    const model = { columns: cols('Size', 'X'), rows: [row('M', '57')], note: '' }
    expect(mergeSizeGuideIntoHtml(model, '<div>tùy biến</div>')).toBe(serializeSizeGuide(model))
  })

  it('sửa HTML size dạng tiêu đề + đoạn văn vẫn giữ khung trình bày', () => {
    const existing = '<h3 style="color:blue">M</h3><p class="measure">57</p>'
    const out = mergeSizeGuideIntoHtml(
      { columns: cols('Size', 'Vòng đầu'), rows: [row('M', '58')] },
      existing,
    )
    expect(out).toContain('style="color:blue"')
    expect(out).toContain('class="measure"')
    expect(out).toContain('>58</p>')
  })

  it('bảng không có thead vẫn giữ được bảng khi sửa biểu mẫu', () => {
    const existing =
      '<table><tr><th>Size</th><th>Vòng đầu</th></tr><tr><td>M</td><td>57</td></tr></table>'
    const out = mergeSizeGuideIntoHtml(
      { columns: cols('Size', 'Vòng đầu'), rows: [row('M', '58')] },
      existing,
    )
    expect(out).toContain('<thead>')
    expect(out).toContain('>58<')
    expect(out).not.toContain('>57<')
  })
})
