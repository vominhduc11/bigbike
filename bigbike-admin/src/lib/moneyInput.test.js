import { describe, expect, it } from 'vitest'
import {
  caretAfterSanitize,
  countDigitsBeforeCaret,
  formatMoneyInput,
  normalizeMoneyDraft,
  parseMoneyInput,
  toMoneyNumberOrNull,
} from './moneyInput'

describe('money input helpers', () => {
  it('formats only on commit and supports Vietnamese/English grouping', () => {
    expect(formatMoneyInput('220000', 'vi-VN')).toBe('220.000')
    expect(formatMoneyInput('1600000', 'vi-VN')).toBe('1.600.000')
    expect(formatMoneyInput('1600000', 'en-US')).toBe('1,600,000')
  })

  it('normalizes unformatted and both common formatted paste values', () => {
    expect(normalizeMoneyDraft('2000000')).toBe('2000000')
    expect(normalizeMoneyDraft('2.000.000')).toBe('2000000')
    expect(normalizeMoneyDraft('2,000,000')).toBe('2000000')
    expect(parseMoneyInput('2.000.000')).toBe(2000000)
  })

  it('preserves a negative sign and invalid text instead of converting it to another positive number', () => {
    expect(normalizeMoneyDraft('-2.000.000')).toBe('-2000000')
    expect(toMoneyNumberOrNull('-2000000')).toBe(-2000000)
    expect(parseMoneyInput('abc2000000')).toBe(Number.NaN)
    expect(parseMoneyInput('1.2')).toBe(Number.NaN)
    expect(parseMoneyInput('2.000,000')).toBe(Number.NaN)
    expect(toMoneyNumberOrNull('abc2000000')).toBe(Number.NaN)
  })

  it('keeps the caret aligned when separators are removed', () => {
    expect(countDigitsBeforeCaret('2.200.000', 4)).toBe(3)
    expect(caretAfterSanitize('2.200.000', 4)).toBe(3)
    expect(caretAfterSanitize('2.200.000', 9)).toBe(7)
  })

  it('keeps empty/null semantics and maps sale zero to null when requested', () => {
    expect(toMoneyNumberOrNull('')).toBeNull()
    expect(toMoneyNumberOrNull(null)).toBeNull()
    expect(toMoneyNumberOrNull('0')).toBe(0)
    expect(toMoneyNumberOrNull('0', { zeroAsEmpty: true })).toBeNull()
    expect(formatMoneyInput('0', 'vi-VN', { zeroAsEmpty: true })).toBe('')
  })
})
