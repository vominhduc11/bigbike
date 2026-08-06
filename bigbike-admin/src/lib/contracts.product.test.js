import { describe, it, expect } from 'vitest'
import { normalizeProduct } from './contracts'

/**
 * Regression 2026-08-06 — slug tiếng Anh biến mất khỏi màn hình sửa sản phẩm.
 *
 * `normalizeProduct` lọc response theo danh sách trắng. Nó từng bỏ sót `slugEn` (field
 * top-level của Product, V214), nên mọi lệnh đọc/ghi sản phẩm đi qua đây đều đánh rơi
 * đường dẫn tiếng Anh: ô Đường dẫn tab EN luôn trống dù DB có dữ liệu, và bấm Lưu gửi
 * slug rỗng khiến backend full-replace xoá trắng cột slug_en.
 */
describe('normalizeProduct — đường dẫn tiếng Anh (slugEn)', () => {
  const response = {
    id: 'wp-prod-35026',
    slug: 'tai-nghe-scs-s7x-bluetooth-cho-mu-bao-hiem',
    slugEn: 'scs-s7x-motorcycle-bluetooth-helmet-headset',
    name: 'Tai nghe bluetooth SCS S7X',
  }

  it('giữ slugEn từ dữ liệu máy chủ trả về', () => {
    expect(normalizeProduct(response).slugEn).toBe('scs-s7x-motorcycle-bluetooth-helmet-headset')
  })

  it('không đụng tới slug tiếng Việt', () => {
    expect(normalizeProduct(response).slug).toBe('tai-nghe-scs-s7x-bluetooth-cho-mu-bao-hiem')
  })

  it('thiếu slugEn thì trả undefined, không rơi về slug tiếng Việt', () => {
    const { slugEn: _omit, ...withoutEn } = response
    const product = normalizeProduct(withoutEn)
    expect(product.slugEn).toBeUndefined()
    expect(product.slug).toBe('tai-nghe-scs-s7x-bluetooth-cho-mu-bao-hiem')
  })

  it('slugEn rỗng hoặc toàn khoảng trắng được coi như chưa nhập', () => {
    expect(normalizeProduct({ ...response, slugEn: '' }).slugEn).toBeUndefined()
    expect(normalizeProduct({ ...response, slugEn: '   ' }).slugEn).toBeUndefined()
  })

  it('cắt khoảng trắng thừa quanh slugEn', () => {
    expect(normalizeProduct({ ...response, slugEn: '  scs-s7x-headset  ' }).slugEn)
      .toBe('scs-s7x-headset')
  })
})
