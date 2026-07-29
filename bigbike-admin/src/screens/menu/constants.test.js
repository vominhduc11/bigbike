import { describe, expect, it } from 'vitest'
import {
  buildCategoryMenuUrl,
  buildMenuTree,
  collectDescendantIds,
  flattenMenuTree,
  isItemFormValid,
  isValidCustomUrl,
  normalizeMenuUrlForSave,
} from './constants'

// isValidCustomUrl phải mirror máy chủ MenuSupport.validateMenuItemUrl — client không được
// coi là hợp lệ những URL mà server sẽ chặn (tránh submit rồi nhận lỗi khó hiểu).
describe('isValidCustomUrl — khớp allowlist scheme của máy chủ', () => {
  it('chấp nhận đường dẫn nội bộ, neo, tel, mailto, http(s)', () => {
    for (const url of ['/danh-muc/mu', '#khuyen-mai', 'tel:0900', 'mailto:a@b.vn', 'https://bigbike.vn', 'http://x.vn']) {
      expect(isValidCustomUrl(url), url).toBe(true)
    }
  })

  it('chặn scheme nguy hiểm mà máy chủ cũng chặn', () => {
    for (const url of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'vbscript:msgbox', '//evil.com']) {
      expect(isValidCustomUrl(url), url).toBe(false)
    }
  })

  it('chặn URL chứa ký tự xuống dòng (CRLF injection)', () => {
    expect(isValidCustomUrl('/ok\nSet-Cookie: x')).toBe(false)
  })

  it('chặn chuỗi rỗng và scheme lạ', () => {
    expect(isValidCustomUrl('')).toBe(false)
    expect(isValidCustomUrl('ftp://x.vn')).toBe(false)
    expect(isValidCustomUrl('ten-khong-scheme')).toBe(false)
  })
})

describe('URL storefront chuẩn', () => {
  it('tạo link danh mục mới có trailing slash', () => {
    expect(buildCategoryMenuUrl({ slug: 'non-bao-hiem-moto' }))
      .toBe('/danh-muc/non-bao-hiem-moto/')
  })

  it('chuẩn hoá link cũ trước khi lưu mà vẫn giữ query string', () => {
    expect(normalizeMenuUrlForSave('/danh-muc-san-pham/non-bao-hiem-moto/?page=2'))
      .toBe('/danh-muc/non-bao-hiem-moto/?page=2')
    expect(normalizeMenuUrlForSave('/san-pham/')).toBe('/sp/')
  })
})

describe('isItemFormValid', () => {
  it('cần cả nhãn lẫn URL hợp lệ', () => {
    expect(isItemFormValid({ label: 'Trang chủ', url: '/' })).toBe(true)
    expect(isItemFormValid({ label: '', url: '/' })).toBe(false)
    expect(isItemFormValid({ label: 'X', url: 'javascript:void(0)' })).toBe(false)
  })
})

describe('buildMenuTree + flatten + collectDescendantIds', () => {
  const items = [
    { id: 'a', parentId: null, sortOrder: 0 },
    { id: 'b', parentId: 'a', sortOrder: 0 },
    { id: 'c', parentId: 'a', sortOrder: 1 },
    { id: 'd', parentId: 'b', sortOrder: 0 },
  ]

  it('dựng cây cha-con và duyệt phẳng theo độ sâu', () => {
    const flat = flattenMenuTree(buildMenuTree(items))
    expect(flat.map((n) => n.id)).toEqual(['a', 'b', 'd', 'c'])
    expect(flat.find((n) => n.id === 'd').depth).toBe(2)
  })

  it('gom toàn bộ hậu duệ để chặn tự chọn làm cha của chính mình', () => {
    // collectDescendantIds trả về Set — spread ra mảng để so sánh ổn định.
    expect([...collectDescendantIds(items, 'a')].sort()).toEqual(['b', 'c', 'd'])
    expect([...collectDescendantIds(items, 'b')]).toEqual(['d'])
  })
})
