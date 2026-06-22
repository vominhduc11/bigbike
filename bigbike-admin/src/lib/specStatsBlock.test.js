import { describe, it, expect } from 'vitest'
import { serializeSpecStats, parseSpecStatsFromHtml, mergeSpecStatsIntoHtml } from './specStatsBlock'

const stat = (value, label) => ({ value, label })

describe('serializeSpecStats', () => {
  it('rỗng / ô trống → chuỗi rỗng', () => {
    expect(serializeSpecStats(null)).toBe('')
    expect(serializeSpecStats([])).toBe('')
    expect(serializeSpecStats([stat('', '')])).toBe('')
  })

  it('xuất lưới bb-specstats với value + label', () => {
    const html = serializeSpecStats([stat('1.4 kg', 'Trọng lượng'), stat('5 sao', 'An toàn')])
    expect(html).toContain('class="bb-specstats"')
    expect(html).toContain('1.4 kg')
    expect(html).toContain('Trọng lượng')
    expect(html).toContain('5 sao')
  })

  it('escape ký tự HTML', () => {
    const html = serializeSpecStats([stat('<b>x</b>', '& y')])
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('&amp; y')
    expect(html).not.toContain('<b>x</b>')
  })
})

describe('parseSpecStatsFromHtml', () => {
  it('rỗng → mảng rỗng', () => {
    expect(parseSpecStatsFromHtml('')).toEqual([])
    expect(parseSpecStatsFromHtml(null)).toEqual([])
  })

  it('round-trip giữ nguyên value/label', () => {
    const stats = [stat('1.4 kg', 'Trọng lượng'), stat('5 sao', 'An toàn')]
    const parsed = parseSpecStatsFromHtml(serializeSpecStats(stats))
    expect(parsed.map((s) => ({ value: s.value, label: s.label }))).toEqual(stats)
    expect(parsed.every((s) => s._key)).toBe(true)
  })

  it('đọc lưới tùy biến có style, bỏ qua CSS', () => {
    const html =
      '<div class="bb-specstats" style="display:grid"><div style="color:red"><span>10</span><span>Năm</span></div></div>'
    expect(parseSpecStatsFromHtml(html).map((s) => ({ value: s.value, label: s.label }))).toEqual([stat('10', 'Năm')])
  })
})

describe('mergeSpecStatsIntoHtml', () => {
  it('html trống → sinh mặc định', () => {
    const stats = [stat('A', 'B')]
    expect(mergeSpecStatsIntoHtml(stats, '')).toBe(serializeSpecStats(stats))
  })

  it('GIỮ NGUYÊN style, chỉ đổi text', () => {
    const styled =
      '<div class="bb-specstats" style="gap:2px"><div style="background:#eee"><span style="color:blue">Cũ</span><span>nhãn cũ</span></div></div>'
    const out = mergeSpecStatsIntoHtml([stat('Mới', 'nhãn mới')], styled)
    expect(out).toContain('style="gap:2px"')
    expect(out).toContain('style="background:#eee"')
    expect(out).toContain('style="color:blue"')
    expect(out).toContain('Mới')
    expect(out).toContain('nhãn mới')
    expect(out).not.toContain('Cũ')
  })

  it('thêm ô → nhân bản giữ style ô cuối', () => {
    const styled =
      '<div class="bb-specstats"><div style="padding:4px"><span>A</span><span>a</span></div></div>'
    const out = mergeSpecStatsIntoHtml([stat('A', 'a'), stat('B', 'b')], styled)
    expect(out).toContain('B')
    expect((out.match(/style="padding:4px"/g) || []).length).toBe(2)
  })

  it('bớt ô → gỡ node thừa', () => {
    const styled =
      '<div class="bb-specstats"><div><span>A</span><span>a</span></div><div><span>B</span><span>b</span></div></div>'
    const out = mergeSpecStatsIntoHtml([stat('A', 'a')], styled)
    expect(out).toContain('>A<')
    expect(out).not.toContain('>B<')
  })

  it('không còn ô → gỡ lưới', () => {
    const styled = '<div class="bb-specstats"><div><span>A</span><span>a</span></div></div>'
    expect(mergeSpecStatsIntoHtml([], styled)).toBe('')
  })
})
