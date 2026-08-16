import { describe, expect, it } from 'vitest'
import { normalizeSizeScaleValue, parseSizeScaleValues } from './sizeScaleUtils'

describe('size scale value parser', () => {
  it('keeps the comma-separated order and trims labels', () => {
    expect(parseSizeScaleValues(' XS, S, M, L ')).toEqual({
      values: ['XS', 'S', 'M', 'L'],
      duplicate: '',
    })
  })

  it('detects canonical duplicates such as M/m and 2XL/XXL', () => {
    expect(parseSizeScaleValues('S, M, m')).toEqual({
      values: ['S', 'M', 'm'],
      duplicate: 'm',
    })
    expect(normalizeSizeScaleValue('2XL')).toBe('XXL')
    expect(parseSizeScaleValues('XL, 2XL, XXL').duplicate).toBe('XXL')
  })
})
