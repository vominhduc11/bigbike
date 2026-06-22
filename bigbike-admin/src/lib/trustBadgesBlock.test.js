import { describe, it, expect } from 'vitest'
import { serializeTrustBadges, parseTrustBadgesFromHtml, mergeTrustBadgesIntoHtml } from './trustBadgesBlock'

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
})
