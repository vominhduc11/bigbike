import { describe, it, expect } from 'vitest'
import { serializeSpecs, parseSpecsFromHtml, parseSpecsResult, mergeSpecsIntoHtml } from './specSheet'

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

  it('escape tên nhưng giữ inline HTML an toàn trong giá trị', () => {
    const html = serializeSpecs([spec('<b>x</b>', '<strong>Đậm</strong> & <em>nghiêng</em>')])
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('<strong>Đậm</strong> &amp; <em>nghiêng</em>')
    expect(html).not.toContain('<th scope="row"><b>x</b>')
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

  it('bảng 3 cột chỉ đưa hai cột đầu vào biểu mẫu và báo cột dư', () => {
    const html = '<table><tbody><tr><th scope="row">Trọng lượng</th><td>1350</td><td>gram</td></tr></tbody></table>'
    const result = parseSpecsResult(html)
    expect(result.items.map(({ name, value }) => ({ name, value }))).toEqual([spec('Trọng lượng', '1350')])
    expect(result.extraColumnCount).toBe(1)
  })

  it('đọc và giữ inline đậm/nghiêng trong ô giá trị', () => {
    const result = parseSpecsResult(
      '<table><tbody><tr><th scope="row">Trọng lượng</th><td><strong>1350</strong> <em>gram</em></td></tr></tbody></table>',
    )
    expect(result.items[0].value).toBe('<strong>1350</strong> <em>gram</em>')
  })

	it('fallback text "tên: giá trị"', () => {
    expect(parseSpecsFromHtml('Chất liệu: Carbon\nTrọng lượng: 1.4 kg').map((r) => ({ name: r.name, value: r.value })))
      .toEqual([spec('Chất liệu', 'Carbon'), spec('Trọng lượng', '1.4 kg')])
	})

	it('đọc HTML thông thường dạng tiêu đề + đoạn văn', () => {
		expect(parseSpecsResult('<h3>Trọng lượng</h3><p>1350 gram</p>').items.map(({ name, value }) => ({ name, value })))
			.toEqual([spec('Trọng lượng', '1350 gram')])
	})

	it('đọc thông số dạng danh sách gạch đầu dòng', () => {
		const result = parseSpecsResult('<ul><li>Trọng lượng: 1350 gram</li><li>Chuẩn: ECE 22.06</li></ul>')
		expect(result.items.map(({ name, value }) => ({ name, value }))).toEqual([
			spec('Trọng lượng', '1350 gram'),
			spec('Chuẩn', 'ECE 22.06'),
		])
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

	it('sửa HTML tiêu đề + đoạn văn vẫn giữ khung trình bày', () => {
		const existing = '<h3 style="color:blue">Cũ</h3><p class="value">1</p>'
		const out = mergeSpecsIntoHtml([spec('Mới', '2')], existing)
		expect(out).toContain('style="color:blue"')
		expect(out).toContain('class="value"')
		expect(out).toContain('Mới')
		expect(out).toContain('2')
	})

  it('sửa bảng 3 cột không nhân đôi hoặc xoá cột thứ ba', () => {
    const existing = '<table><tbody><tr><th scope="row">Trọng lượng</th><td>1350</td><td>gram</td></tr></tbody></table>'
    const out = mergeSpecsIntoHtml([spec('Trọng lượng', '1350 gram')], existing)
    expect(out.match(/1350 gram/g)).toHaveLength(1)
    expect(out.match(/gram/g)).toHaveLength(2)
    expect(out).toContain('<td>gram</td>')
  })

  it('sửa bảng không làm mất inline đậm/nghiêng trong ô giá trị', () => {
    const existing =
      '<table><tbody><tr><th scope="row">Trọng lượng</th><td><strong>1350</strong> <em>gram</em></td></tr></tbody></table>'
    const out = mergeSpecsIntoHtml(
      [spec('Trọng lượng', '<strong>1350</strong> <em>gram</em>')],
      existing,
    )
    expect(out).toContain('<strong>1350</strong>')
    expect(out).toContain('<em>gram</em>')
  })
})
