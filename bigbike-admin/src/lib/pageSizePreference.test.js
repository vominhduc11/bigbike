import { beforeEach, describe, expect, it } from 'vitest'
import {
  pageSizeStorageKey,
  persistPageSizePreference,
  readPageSizePreference,
} from './pageSizePreference'

describe('page size preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/admin/products')
  })

  it('ưu tiên URL hợp lệ trước lựa chọn đã lưu', () => {
    window.localStorage.setItem('page-size:products', '50')
    expect(readPageSizePreference(20, { search: '?pageSize=100' })).toBe(100)
  })

  it('dùng lựa chọn đã lưu khi URL không có hoặc không hợp lệ', () => {
    window.localStorage.setItem('page-size:products', '50')
    expect(readPageSizePreference(20)).toBe(50)
    expect(readPageSizePreference(20, { search: '?pageSize=999' })).toBe(50)
  })

  it('trở về mặc định khi dữ liệu lưu hỏng hoặc storage bị chặn', () => {
    window.localStorage.setItem('page-size:products', 'not-a-number')
    expect(readPageSizePreference(20)).toBe(20)
    expect(readPageSizePreference(20, {
      storage: { getItem: () => { throw new Error('blocked') } },
    })).toBe(20)
  })

  it('ghi đúng khóa từng màn và bỏ qua giá trị ngoài danh sách', () => {
    persistPageSizePreference(50)
    persistPageSizePreference(999)
    expect(pageSizeStorageKey()).toBe('page-size:products')
    expect(window.localStorage.getItem('page-size:products')).toBe('50')
  })

  it('hỗ trợ thang số dòng riêng của thư viện ảnh', () => {
    window.history.replaceState({}, '', '/admin/media')
    persistPageSizePreference(96)
    expect(readPageSizePreference(24)).toBe(96)
    expect(readPageSizePreference(24, { search: '?pageSize=50' })).toBe(96)
  })
})
