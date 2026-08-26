import { describe, expect, it } from 'vitest'
import { currentVietnamIsoDate, formatCurrencyVnd } from './formatters'

describe('admin locale and Vietnam reporting date', () => {
  it('uses the Vietnam calendar date even when UTC is still on the previous day', () => {
    expect(currentVietnamIsoDate(new Date('2026-08-22T18:30:00Z'))).toBe('2026-08-23')
  })

  it('formats money by the selected admin language instead of the browser default', () => {
    expect(formatCurrencyVnd(1590000, 'vi-VN')).toContain('1.590.000')
    expect(formatCurrencyVnd(1590000, 'en-US')).toContain('1,590,000')
  })
})
