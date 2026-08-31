import { describe, expect, it } from 'vitest'
import { normalizeSizeScaleValue, parseSizeScaleValues } from './sizeScaleUtils'
import { buildVariantMatrixVariants } from './variantMatrixUtils'

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

describe('variant matrix money input', () => {
  it('keeps selected dictionary IDs and shared price on every generated variant', () => {
    const variants = buildVariantMatrixVariants(
      [
        { name: 'Màu sắc', valueIds: ['value-red', 'value-blue'], values: ['Đỏ', 'Xanh'] },
        { name: 'Kích cỡ', valueIds: ['value-m'], values: ['M'] },
      ],
      { sharedPrice: '2000000' },
    )

    expect(variants).toHaveLength(2)
    expect(variants[0]).toMatchObject({
      retailPrice: '2000000',
      salePrice: '',
    })
    expect(variants[0].options).toEqual([
      { name: 'Màu sắc', value: 'Đỏ', attributeValueId: 'value-red' },
      { name: 'Kích cỡ', value: 'M', attributeValueId: 'value-m' },
    ])
  })
})
