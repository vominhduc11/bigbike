import { describe, it, expect } from 'vitest'
import { serializeSpecStats, parseSpecStatsFromHtml, mergeSpecStatsIntoHtml } from './specStatsBlock'

const stat = (value, unit, label) => ({ value, unit, label })
const trim = (s) => ({ value: s.value, unit: s.unit, label: s.label })

describe('serializeSpecStats', () => {
  it('rỗng / ô trống → chuỗi rỗng', () => {
    expect(serializeSpecStats(null)).toBe('')
    expect(serializeSpecStats([])).toBe('')
    expect(serializeSpecStats([stat('', '', '')])).toBe('')
  })

  it('xuất lưới bb-specstats với value + unit + label (3 dòng)', () => {
    const html = serializeSpecStats([stat('1.350', 'gram', 'Trọng lượng'), stat('ECE', '22.06', 'Chuẩn an toàn')])
    expect(html).toContain('class="bb-specstats"')
    expect(html).toContain('1.350')
    expect(html).toContain('gram')
    expect(html).toContain('Trọng lượng')
    expect(html).toContain('22.06')
  })

  it('đơn vị trống → ô chỉ 2 span (value + label)', () => {
    const html = serializeSpecStats([stat('5 sao', '', 'An toàn')])
    expect((html.match(/<span/g) || []).length).toBe(2)
    expect(html).toContain('5 sao')
    expect(html).toContain('An toàn')
  })

  it('escape ký tự HTML', () => {
    const html = serializeSpecStats([stat('<b>x</b>', '& z', '& y')])
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('&amp; y')
    expect(html).toContain('&amp; z')
    expect(html).not.toContain('<b>x</b>')
  })
})

describe('parseSpecStatsFromHtml', () => {
  it('rỗng → mảng rỗng', () => {
    expect(parseSpecStatsFromHtml('')).toEqual([])
    expect(parseSpecStatsFromHtml(null)).toEqual([])
  })

  it('round-trip giữ nguyên value/unit/label', () => {
    const stats = [stat('1.350', 'gram', 'Trọng lượng'), stat('2+4', 'cửa gió', 'Nạp + thoát')]
    const parsed = parseSpecStatsFromHtml(serializeSpecStats(stats))
    expect(parsed.map(trim)).toEqual(stats)
    expect(parsed.every((s) => s._key)).toBe(true)
  })

  it('back-compat: HTML legacy 2 span → value + label, đơn vị rỗng', () => {
    const html =
      '<div class="bb-specstats" style="display:grid"><div style="color:red"><span>10</span><span>Năm</span></div></div>'
    expect(parseSpecStatsFromHtml(html).map(trim)).toEqual([stat('10', '', 'Năm')])
  })
})

describe('mergeSpecStatsIntoHtml', () => {
  it('html trống → sinh mặc định', () => {
    const stats = [stat('A', 'u', 'B')]
    expect(mergeSpecStatsIntoHtml(stats, '')).toBe(serializeSpecStats(stats))
  })

  it('GIỮ NGUYÊN style span value/label, chỉ đổi text', () => {
    const styled =
      '<div class="bb-specstats" style="gap:2px"><div style="background:#eee"><span style="color:blue">Cũ</span><span>nhãn cũ</span></div></div>'
    const out = mergeSpecStatsIntoHtml([stat('Mới', '', 'nhãn mới')], styled)
    expect(out).toContain('style="gap:2px"')
    expect(out).toContain('style="background:#eee"')
    expect(out).toContain('style="color:blue"')
    expect(out).toContain('Mới')
    expect(out).toContain('nhãn mới')
    expect(out).not.toContain('Cũ')
  })

  it('thêm dòng đơn vị vào ô legacy 2 span → chèn span giữa, giữ label cuối', () => {
    const styled =
      '<div class="bb-specstats"><div style="padding:4px"><span style="color:blue">10</span><span>Năm</span></div></div>'
    const out = mergeSpecStatsIntoHtml([stat('10', 'tháng', 'Năm')], styled)
    expect(out).toContain('style="color:blue"') // style value giữ nguyên
    expect(out).toContain('tháng')
    // round-trip lại phải ra đúng 3 trường
    expect(parseSpecStatsFromHtml(out).map(trim)).toEqual([stat('10', 'tháng', 'Năm')])
  })

  it('xoá dòng đơn vị khỏi ô 3 span → còn value + label', () => {
    const html = serializeSpecStats([stat('10', 'tháng', 'Năm')])
    const out = mergeSpecStatsIntoHtml([stat('10', '', 'Năm')], html)
    expect(out).not.toContain('tháng')
    expect(parseSpecStatsFromHtml(out).map(trim)).toEqual([stat('10', '', 'Năm')])
  })

  it('thêm ô → nhân bản giữ style ô cuối', () => {
    const styled =
      '<div class="bb-specstats"><div style="padding:4px"><span>A</span><span>a</span></div></div>'
    const out = mergeSpecStatsIntoHtml([stat('A', '', 'a'), stat('B', '', 'b')], styled)
    expect(out).toContain('B')
    expect((out.match(/style="padding:4px"/g) || []).length).toBe(2)
  })

  it('bớt ô → gỡ node thừa', () => {
    const styled =
      '<div class="bb-specstats"><div><span>A</span><span>a</span></div><div><span>B</span><span>b</span></div></div>'
    const out = mergeSpecStatsIntoHtml([stat('A', '', 'a')], styled)
    expect(out).toContain('>A<')
    expect(out).not.toContain('>B<')
  })

  it('không còn ô → gỡ lưới', () => {
    const styled = '<div class="bb-specstats"><div><span>A</span><span>a</span></div></div>'
    expect(mergeSpecStatsIntoHtml([], styled)).toBe('')
  })
})
