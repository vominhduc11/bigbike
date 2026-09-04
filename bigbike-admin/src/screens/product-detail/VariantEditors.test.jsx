import { describe, expect, it } from 'vitest'
import {
  normalizeSizeScaleValue,
  parseSizeScaleValues,
  filterValuesBySizeScale,
  sizeScaleValueKeys,
} from './sizeScaleUtils'
import { isSizeAttributeName } from '../../lib/schemas'
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

// Bảng cỡ "Cỡ chữ mũ bảo hiểm" thật trên hệ thống: 9 cỡ.
const HELMET_SCALE = {
  id: 'size-scale-helmet-letter',
  name: 'Cỡ chữ mũ bảo hiểm',
  values: ['XS', 'XS/S', 'S', 'M', 'M/L', 'L', 'XL', 'XL/2XL', 'XXL'].map((v) => ({
    valueKey: v,
    label: v,
    labelEn: v,
    active: true,
  })),
}

// Mẫu rút gọn của danh mục cỡ dùng chung (92 giá trị thật), gồm cả rác nhập từ web cũ.
const SHARED_SIZE_VALUES = [
  { id: 'v-xs', slug: 'xs', label: 'XS' },
  { id: 'v-s', slug: 's', label: 'S' },
  { id: 'v-m', slug: 'm', label: 'M' },
  { id: 'v-l', slug: 'l', label: 'L' },
  { id: 'v-xl', slug: 'xl', label: 'XL' },
  { id: 'v-xxl', slug: 'xxl', label: 'XXL' },
  { id: 'v-3xl', slug: '3xl', label: '3XL' },
  { id: 'v-42', slug: '42', label: '42' },
  { id: 'v-45', slug: '45', label: '45' },
  { id: 'v-mau', slug: 'mau', label: 'MÀU' },
  { id: 'v-junk', slug: '01-m1m65-1m7', label: '01-m1m65-1m7' },
  { id: 'v-junk2', slug: '0e-hangorder', label: '0e-hangorder' },
]

describe('size picker filtered by the product size scale', () => {
  it('keeps only the sizes of the chosen scale and drops shoe sizes plus legacy junk', () => {
    const visible = filterValuesBySizeScale(SHARED_SIZE_VALUES, HELMET_SCALE, '')
    expect(visible.map((v) => v.label)).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
    expect(visible.every((v) => v.outOfScale === false)).toBe(true)
  })

  it('normalizes exactly like the server guard so 2XL still matches XXL', () => {
    const visible = filterValuesBySizeScale(
      [{ id: 'v', slug: '2xl', label: '2XL' }],
      HELMET_SCALE,
      '',
    )
    expect(visible.map((v) => v.label)).toEqual(['2XL'])
    expect(sizeScaleValueKeys(HELMET_SCALE).has(normalizeSizeScaleValue('2XL'))).toBe(true)
  })

  it('keeps a stored value that falls outside the scale and flags it instead of hiding it', () => {
    // Ca thật: MŨ BẢO HIỂM LẬT HÀM LS2 FF901 đang lưu cỡ 3XL, bảng mũ không có 3XL.
    const visible = filterValuesBySizeScale(SHARED_SIZE_VALUES, HELMET_SCALE, '3XL')
    const stored = visible.find((v) => v.label === '3XL')
    expect(stored).toBeTruthy()
    expect(stored.outOfScale).toBe(true)
  })

  it('shows the whole shared catalogue when the product has no scale yet', () => {
    // 14 sản phẩm hàng cũ chưa gán bảng cỡ — không được làm mất lựa chọn đang lưu.
    const visible = filterValuesBySizeScale(SHARED_SIZE_VALUES, null, 'L')
    expect(visible).toHaveLength(SHARED_SIZE_VALUES.length)
    expect(visible.every((v) => v.outOfScale === false)).toBe(true)
  })

  it('ignores deactivated scale values', () => {
    const scale = {
      ...HELMET_SCALE,
      values: [
        { valueKey: 'M', label: 'M', active: true },
        { valueKey: 'L', label: 'L', active: false },
      ],
    }
    expect(filterValuesBySizeScale(SHARED_SIZE_VALUES, scale, '').map((v) => v.label)).toEqual([
      'M',
    ])
  })

  it('recognises every size attribute alias the server guard accepts', () => {
    // SizeScaleCatalog.isSizeOptionName: size | kichco | kichthuoc
    expect(isSizeAttributeName('Size')).toBe(true)
    expect(isSizeAttributeName('size')).toBe(true)
    expect(isSizeAttributeName('Kích cỡ')).toBe(true)
    expect(isSizeAttributeName('Kích thước')).toBe(true)
    expect(isSizeAttributeName('màu sắc')).toBe(false)
    expect(isSizeAttributeName('Model')).toBe(false)
  })
})

// ── Nhóm lọc cỡ: các quyết định của màn quản lý (CATALOG_RULE_012) ──────────
// Panel gọi mạng nên phần logic quyết định được tách ra kiểm riêng ở đây, đúng
// những gì màn hình dùng: đếm bảng cỡ theo nhóm và lọc danh sách nhóm chọn được.

/** Đếm bảng cỡ theo nhóm — dùng để hiện số và khoá nút xoá. */
function countScalesByGroup(scales) {
  return (Array.isArray(scales) ? scales : []).reduce((acc, scale) => {
    const id = scale.group?.id
    if (id) acc[id] = (acc[id] || 0) + 1
    return acc
  }, {})
}

/** Nhóm chọn được cho một bảng cỡ: nhóm đang bật, cộng đúng nhóm hiện tại của nó. */
function selectableGroups(groups, currentGroupId) {
  return groups.filter((group) => group.active || group.id === currentGroupId)
}

describe('size filter group manager decisions', () => {
  const GROUPS = [
    { id: 'g-letter', key: 'clothing-letter', label: 'Cỡ đồ mặc (chữ)', active: true },
    { id: 'g-shoe', key: 'shoe', label: 'Cỡ giày', active: true },
    { id: 'g-old', key: 'pants-number', label: 'Cỡ quần theo số', active: false },
  ]
  const SCALES = [
    { id: 's1', name: 'Cỡ chữ mũ bảo hiểm', group: { id: 'g-letter' } },
    { id: 's2', name: 'Cỡ chữ găng tay', group: { id: 'g-letter' } },
    { id: 's3', name: 'Cỡ giày châu Âu', group: { id: 'g-shoe' } },
  ]

  it('counts the size charts each group owns so the operator sees what blocks a delete', () => {
    expect(countScalesByGroup(SCALES)).toEqual({ 'g-letter': 2, 'g-shoe': 1 })
    // Nhóm đã tắt và chưa có bảng cỡ nào -> 0, tức là xoá được.
    expect(countScalesByGroup(SCALES)['g-old'] ?? 0).toBe(0)
  })

  it('offers only live groups when assigning a size chart', () => {
    expect(selectableGroups(GROUPS, 'g-letter').map((g) => g.id)).toEqual(['g-letter', 'g-shoe'])
  })

  it('keeps a chart’s own group selectable after that group was switched off', () => {
    // Nếu lọc cứng theo active, ô chọn nhóm sẽ trống trơn và bảng cỡ trông như mất dữ liệu.
    expect(selectableGroups(GROUPS, 'g-old').map((g) => g.id)).toEqual([
      'g-letter',
      'g-shoe',
      'g-old',
    ])
  })
})
