import { describe, it, expect } from 'vitest'
import { serializeTrustBadges, parseTrustBadgesFromHtml, parseTrustBadgesResult, mergeTrustBadgesIntoHtml } from './trustBadgesBlock'

const badge = (content) => ({ content })

describe('serializeTrustBadges', () => {
  it('rỗng / mục trống → chuỗi rỗng', () => {
    expect(serializeTrustBadges(null)).toBe('')
    expect(serializeTrustBadges([])).toBe('')
    expect(serializeTrustBadges([badge('')])).toBe('')
  })

  it('xuất dải bb-trust-badges với nội dung', () => {
    const html = serializeTrustBadges([badge('Chính hãng'), badge('BH 2 năm')])
    expect(html).toContain('class="bb-trust-badges"')
    expect(html).toContain('Chính hãng')
    expect(html).toContain('BH 2 năm')
  })

  it('escape ký tự HTML', () => {
    expect(serializeTrustBadges([badge('<b>x</b> & y')])).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y')
  })
})

describe('parseTrustBadgesFromHtml', () => {
  it('rỗng → mảng rỗng', () => {
    expect(parseTrustBadgesFromHtml('')).toEqual([])
    expect(parseTrustBadgesFromHtml(null)).toEqual([])
  })

  it('round-trip giữ nguyên nội dung', () => {
    const badges = [badge('Chính hãng'), badge('Freeship')]
    const parsed = parseTrustBadgesFromHtml(serializeTrustBadges(badges))
    expect(parsed.map((b) => ({ content: b.content }))).toEqual(badges)
    expect(parsed.every((b) => b._key)).toBe(true)
  })

  it('bỏ qua chấm tròn, lấy đúng chữ', () => {
    const html =
      '<div class="bb-trust-badges"><span><span style="background:red"></span><span>Chính hãng</span></span></div>'
    expect(parseTrustBadgesFromHtml(html).map((b) => b.content)).toEqual(['Chính hãng'])
  })

	it('HTML nhập ngoài: chấm "•" là ký tự trước chữ, không phải span rỗng', () => {
    const html =
      '<div class="bb-trust-badges">' +
      '<span><span style="color:#cc0906;font-size:18px">•</span> Tặng kèm Pinlock</span> ' +
      '<span><span style="color:#cc0906;font-size:18px">•</span> FreeShip Toàn Quốc</span></div>'
    expect(parseTrustBadgesFromHtml(html).map((b) => b.content)).toEqual([
      'Tặng kèm Pinlock',
      'FreeShip Toàn Quốc',
    ])
	})

	it('đọc danh sách HTML thông thường', () => {
		const result = parseTrustBadgesResult('<ul><li>Chính hãng</li><li>Freeship</li></ul>')
		expect(result.items.map((item) => item.content)).toEqual(['Chính hãng', 'Freeship'])
		expect(result.acceptedCount).toBe(2)
	})
})

describe('mergeTrustBadgesIntoHtml', () => {
  it('html trống → sinh mặc định', () => {
    const badges = [badge('A')]
    expect(mergeTrustBadgesIntoHtml(badges, '')).toBe(serializeTrustBadges(badges))
  })

  it('GIỮ NGUYÊN style + chấm tròn, chỉ đổi chữ', () => {
    const styled =
      '<div class="bb-trust-badges" style="gap:4px"><span style="color:blue"><span style="background:red"></span><span>Cũ</span></span></div>'
    const out = mergeTrustBadgesIntoHtml([badge('Mới')], styled)
    expect(out).toContain('style="gap:4px"')
    expect(out).toContain('style="color:blue"')
    expect(out).toContain('background:red')
    expect(out).toContain('Mới')
    expect(out).not.toContain('Cũ')
  })

  it('thêm mục → nhân bản giữ style mục cuối', () => {
    const styled = '<div class="bb-trust-badges"><span style="padding:2px"><span></span><span>A</span></span></div>'
    const out = mergeTrustBadgesIntoHtml([badge('A'), badge('B')], styled)
    expect(out).toContain('B')
    expect((out.match(/style="padding:2px"/g) || []).length).toBe(2)
  })

  it('không còn mục → gỡ dải', () => {
    const styled = '<div class="bb-trust-badges"><span><span></span><span>A</span></span></div>'
    expect(mergeTrustBadgesIntoHtml([], styled)).toBe('')
  })

  it('HTML nhập ngoài (chấm "•" + chữ text node): đổi chữ không nhân đôi, giữ chấm', () => {
    const imported =
      '<div class="bb-trust-badges"><span><span style="color:#cc0906">•</span> Cũ</span></div>'
    const out = mergeTrustBadgesIntoHtml([badge('Mới')], imported)
    expect(out).toContain('Mới')
    expect(out).not.toContain('Cũ')
    expect(out).toContain('•')
    // Không được lặp lại chữ mới hai lần.
    expect((out.match(/Mới/g) || []).length).toBe(1)
  })
})
