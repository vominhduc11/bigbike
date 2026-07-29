import { describe, expect, it } from 'vitest'
import {
  inclusiveDateSpan,
  isIsoCalendarDate,
  normalizeReportPreset,
  resolveReportRange,
  shiftRangeBack,
  todayInVietnam,
} from './dateRange'

describe('reports date range', () => {
  it('uses the Vietnam calendar date regardless of the device timezone boundary', () => {
    const instant = new Date('2026-07-29T17:30:00.000Z')
    expect(todayInVietnam(instant)).toBe('2026-07-30')
  })

  it('builds inclusive preset ranges from the Vietnam date', () => {
    const instant = new Date('2026-07-29T17:30:00.000Z')
    expect(resolveReportRange('7d', '', '', instant)).toEqual({
      from: '2026-07-24',
      to: '2026-07-30',
    })
    expect(resolveReportRange('90d', '', '', instant)).toEqual({
      from: '2026-05-02',
      to: '2026-07-30',
    })
  })

  it('keeps a complete custom range unchanged', () => {
    expect(resolveReportRange('custom', '2026-06-01', '2026-06-30')).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })

  it('moves comparison ranges to the immediately preceding period with equal length', () => {
    expect(shiftRangeBack('2026-07-24', '2026-07-30')).toEqual({
      from: '2026-07-17',
      to: '2026-07-23',
    })
  })

  it('counts the selected dates inclusively and handles leap days', () => {
    expect(inclusiveDateSpan('2024-02-28', '2024-03-01')).toBe(3)
    expect(inclusiveDateSpan('2026-05-02', '2026-07-30')).toBe(90)
  })

  it('rejects malformed, impossible and inverted calendar ranges', () => {
    expect(isIsoCalendarDate('2026-02-29')).toBe(false)
    expect(isIsoCalendarDate('2024-02-29')).toBe(true)
    expect(isIsoCalendarDate('29-07-2026')).toBe(false)
    expect(inclusiveDateSpan('2026-08-01', '2026-07-30')).toBeNull()
    expect(shiftRangeBack('not-a-date', '2026-07-30')).toEqual({ from: '', to: '' })
  })

  it('normalizes unknown URL presets to the documented 30-day default', () => {
    expect(normalizeReportPreset('7d')).toBe('7d')
    expect(normalizeReportPreset('custom')).toBe('custom')
    expect(normalizeReportPreset('999d')).toBe('30d')
  })
})
