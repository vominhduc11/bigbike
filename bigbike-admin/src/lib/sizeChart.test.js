import { describe, it, expect } from 'vitest'
import { parseSizeGuide, serializeSizeGuide, SIZE_COL2_DEFAULT } from './sizeChart'

describe('serializeSizeGuide', () => {
  it('rỗng → chuỗi rỗng', () => {
    expect(serializeSizeGuide(null)).toBe('')
    expect(serializeSizeGuide({ col2: 'X', rows: [], note: '' })).toBe('')
    expect(serializeSizeGuide({ rows: [{ size: '', value: '' }] })).toBe('')
  })

  it('xuất <table> với header + dòng', () => {
    const html = serializeSizeGuide({
      col2: 'Vòng đầu (cm)',
      rows: [{ size: 'M', value: '57 – 58' }, { size: 'L', value: '59 – 60' }],
      note: '',
    })
    expect(html).toContain('<table>')
    expect(html).toContain('<th>Size</th><th>Vòng đầu (cm)</th>')
    expect(html).toContain('<td>M</td><td>57 – 58</td>')
    expect(html).toContain('<td>L</td><td>59 – 60</td>')
    expect(html).not.toContain('<p>')
  })

  it('col2 trống → dùng mặc định; có note → thêm <p>', () => {
    const html = serializeSizeGuide({ col2: '', rows: [{ size: 'M', value: '57' }], note: 'Chọn size lớn hơn' })
    expect(html).toContain(`<th>Size</th><th>${SIZE_COL2_DEFAULT}</th>`)
    expect(html).toContain('<p>Chọn size lớn hơn</p>')
  })

  it('escape ký tự HTML', () => {
    const html = serializeSizeGuide({ rows: [{ size: 'M', value: '<b>x</b> & y' }] })
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y')
    expect(html).not.toContain('<b>x</b>')
  })

  it('cột 3 & 4 chỉ xuất khi có tên cột', () => {
    const html = serializeSizeGuide({
      col2: 'Vòng đầu (cm)',
      col3: 'Kích cỡ vỏ',
      col4: 'Ghi chú',
      rows: [{ size: 'M', value: '57 – 58', value3: 'Shell nhỏ (XS–M)', value4: 'Bán chạy nhất' }],
    })
    expect(html).toContain('<th>Size</th><th>Vòng đầu (cm)</th><th>Kích cỡ vỏ</th><th>Ghi chú</th>')
    expect(html).toContain('<td>M</td><td>57 – 58</td><td>Shell nhỏ (XS–M)</td><td>Bán chạy nhất</td>')
  })

  it('không đặt tên cột 3/4 → giữ nguyên 2 cột (tương thích dữ liệu cũ)', () => {
    const html = serializeSizeGuide({
      col2: 'Vòng đầu (cm)',
      col3: '',
      col4: '',
      rows: [{ size: 'M', value: '57 – 58', value3: 'bị bỏ qua', value4: 'bị bỏ qua' }],
    })
    expect(html).toContain('<th>Size</th><th>Vòng đầu (cm)</th>')
    expect(html).not.toContain('<th>Size</th><th>Vòng đầu (cm)</th><th>')
    expect(html).toContain('<td>M</td><td>57 – 58</td></tr>')
    expect(html).not.toContain('bị bỏ qua')
  })
})

describe('parseSizeGuide', () => {
  it('rỗng → model rỗng mặc định', () => {
    expect(parseSizeGuide('')).toEqual({ col2: SIZE_COL2_DEFAULT, col3: '', col4: '', rows: [], note: '' })
    expect(parseSizeGuide(null)).toEqual({ col2: SIZE_COL2_DEFAULT, col3: '', col4: '', rows: [], note: '' })
  })

  it('round-trip 4 cột giữ nguyên dữ liệu', () => {
    const model = {
      col2: 'Vòng đầu (cm)',
      col3: 'Kích cỡ vỏ',
      col4: 'Ghi chú',
      rows: [{ size: 'M', value: '57 – 58', value3: 'Shell nhỏ (XS–M)', value4: 'Bán chạy nhất' }],
      note: '',
    }
    const parsed = parseSizeGuide(serializeSizeGuide(model))
    expect(parsed.col3).toBe('Kích cỡ vỏ')
    expect(parsed.col4).toBe('Ghi chú')
    expect(parsed.rows.map((r) => ({ size: r.size, value: r.value, value3: r.value3, value4: r.value4 }))).toEqual([
      { size: 'M', value: '57 – 58', value3: 'Shell nhỏ (XS–M)', value4: 'Bán chạy nhất' },
    ])
  })

  it('round-trip serialize → parse giữ nguyên dữ liệu', () => {
    const model = {
      col2: 'Vòng ngực (cm)',
      rows: [{ size: 'M', value: '88 – 92' }, { size: 'L', value: '96 – 100' }],
      note: 'Đo nơi rộng nhất.',
    }
    const parsed = parseSizeGuide(serializeSizeGuide(model))
    expect(parsed.col2).toBe('Vòng ngực (cm)')
    expect(parsed.rows.map((r) => ({ size: r.size, value: r.value }))).toEqual([
      { size: 'M', value: '88 – 92' },
      { size: 'L', value: '96 – 100' },
    ])
    expect(parsed.note).toBe('Đo nơi rộng nhất.')
    expect(parsed.rows.every((r) => r._key)).toBe(true)
  })

  it('fallback: văn bản thuần kiểu "- M: 57-58 cm" → tách thành dòng + ghi chú', () => {
    const legacy = 'Đo chu vi vòng đầu (cm) tại vị trí lớn nhất, rồi đối chiếu:\n- M: 57-58 cm\n- L: 59-60 cm\n- XL: 61-62 cm\nNếu số đo nằm giữa hai size, nên chọn size lớn hơn.'
    const parsed = parseSizeGuide(legacy)
    expect(parsed.rows.map((r) => ({ size: r.size, value: r.value }))).toEqual([
      { size: 'M', value: '57-58 cm' },
      { size: 'L', value: '59-60 cm' },
      { size: 'XL', value: '61-62 cm' },
    ])
    expect(parsed.note).toContain('Đo chu vi vòng đầu')
    expect(parsed.note).toContain('Nếu số đo nằm giữa hai size')
  })
})
