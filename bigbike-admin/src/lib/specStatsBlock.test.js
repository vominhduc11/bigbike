import { describe, it, expect } from 'vitest'
import {
  serializeSpecStats,
  parseSpecStatsFromHtml,
  parseSpecStatsResult,
  mergeSpecStatsIntoHtml,
} from './specStatsBlock'

const stat = (value, label) => ({ value, label })
const trim = (s) => ({ value: s.value, label: s.label })

describe('serializeSpecStats', () => {
  it('rỗng / ô trống → chuỗi rỗng', () => {
    expect(serializeSpecStats(null)).toBe('')
    expect(serializeSpecStats([])).toBe('')
    expect(serializeSpecStats([stat('', '')])).toBe('')
  })

  it('xuất lưới bb-specstats với value + label (2 dòng)', () => {
    const html = serializeSpecStats([
      stat('1.350', 'Trọng lượng'),
      stat('ECE 22.06', 'Chuẩn an toàn'),
    ])
    expect(html).toContain('class="bb-specstats"')
    expect(html).toContain('1.350')
    expect(html).toContain('Trọng lượng')
    expect(html).toContain('ECE 22.06')
    expect((html.match(/<span/g) || []).length).toBe(4)
  })

  it('mỗi ô luôn 2 span (value + label)', () => {
    const html = serializeSpecStats([stat('5 sao', 'An toàn')])
    expect((html.match(/<span/g) || []).length).toBe(2)
    expect(html).toContain('5 sao')
    expect(html).toContain('An toàn')
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
    const stats = [stat('1.350', 'Trọng lượng'), stat('2+4', 'Nạp + thoát')]
    const parsed = parseSpecStatsFromHtml(serializeSpecStats(stats))
    expect(parsed.map(trim)).toEqual(stats)
    expect(parsed.every((s) => s._key)).toBe(true)
  })

  it('back-compat: HTML legacy 3 span (dòng đơn vị cũ) → chỉ lấy value + label', () => {
    const html =
      '<div class="bb-specstats" style="display:grid"><div style="color:red">' +
      '<span>10</span><span>tháng</span><span>Năm</span></div></div>'
    expect(parseSpecStatsFromHtml(html).map(trim)).toEqual([stat('10', 'Năm')])
  })

  it('đọc ô thông thường có số liệu đậm và nhãn', () => {
    const result = parseSpecStatsResult(
      '<div><strong>1.350 gram</strong><span>Trọng lượng</span></div>',
    )
    expect(result.items.map(trim)).toEqual([stat('1.350 gram', 'Trọng lượng')])
  })

  it('đọc HTML thông thường dạng tiêu đề + đoạn văn', () => {
    expect(parseSpecStatsResult('<h3>1.350 gram</h3><p>Trọng lượng</p>').items.map(trim)).toEqual([
      stat('1.350 gram', 'Trọng lượng'),
    ])
  })

  it('HTML không có dấu hiệu ô số liệu không được nhận', () => {
    expect(parseSpecStatsResult('<div>Chỉ có một đoạn văn</div>').acceptedCount).toBe(0)
  })
})

describe('mergeSpecStatsIntoHtml', () => {
  it('html trống → sinh mặc định', () => {
    const stats = [stat('A', 'B')]
    expect(mergeSpecStatsIntoHtml(stats, '')).toBe(serializeSpecStats(stats))
  })

  it('GIỮ NGUYÊN style span value/label, chỉ đổi text', () => {
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

  it('gỡ span đơn vị còn sót ở ô legacy 3 span → chỉ còn value + label', () => {
    const styled =
      '<div class="bb-specstats"><div style="padding:4px">' +
      '<span style="color:blue">10</span><span>tháng</span><span>Năm</span></div></div>'
    const out = mergeSpecStatsIntoHtml([stat('10', 'Năm')], styled)
    expect(out).toContain('style="color:blue"') // style value giữ nguyên
    expect(out).not.toContain('tháng')
    expect(parseSpecStatsFromHtml(out).map(trim)).toEqual([stat('10', 'Năm')])
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
