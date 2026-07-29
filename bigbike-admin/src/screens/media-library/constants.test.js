import { describe, expect, it, vi } from 'vitest'
import {
  ALLOWED_MIME,
  MAX_FILE_SIZE,
  DEFAULT_QUERY,
  hasAdvancedFilters,
  buildActiveChips,
  dateToInstantStart,
  dateToInstantEnd,
} from './constants'

describe('media constants', () => {
  it('cho phép đúng nhóm định dạng ảnh + video mp4, không nhận loại lạ', () => {
    expect(ALLOWED_MIME).toEqual(expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'video/mp4']))
    expect(ALLOWED_MIME).not.toContain('application/pdf')
    expect(ALLOWED_MIME).not.toContain('text/html')
  })

  it('giới hạn dung lượng client là 50MB', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024)
  })
})

describe('hasAdvancedFilters', () => {
  it('false khi không có bộ lọc nâng cao', () => {
    expect(hasAdvancedFilters(DEFAULT_QUERY)).toBe(false)
  })
  it('true khi có bất kỳ bộ lọc ngày/dung lượng/kích thước', () => {
    expect(hasAdvancedFilters({ ...DEFAULT_QUERY, minSize: '1000' })).toBe(true)
    expect(hasAdvancedFilters({ ...DEFAULT_QUERY, uploadedFrom: '2026-07-01' })).toBe(true)
    expect(hasAdvancedFilters({ ...DEFAULT_QUERY, minWidth: '800' })).toBe(true)
  })
})

describe('dateToInstant helpers', () => {
  it('start = 00:00 cùng ngày, end = 00:00 ngày kế (nửa mở)', () => {
    expect(dateToInstantStart('2026-07-15')).toContain('2026-07-1')
    const end = dateToInstantEnd('2026-07-15')
    expect(new Date(end).getTime()).toBeGreaterThan(new Date(dateToInstantStart('2026-07-15')).getTime())
  })
  it('rỗng khi ngày trống hoặc sai', () => {
    expect(dateToInstantStart('')).toBe('')
    expect(dateToInstantEnd('khong-phai-ngay')).toBe('')
  })
})

describe('buildActiveChips', () => {
  const t = (key) => key
  const onRemove = vi.fn()

  it('không tạo chip khi query mặc định', () => {
    expect(buildActiveChips(DEFAULT_QUERY, t, [], onRemove)).toEqual([])
  })

  it('tạo chip cho từng bộ lọc đang áp dụng và gỡ đúng key', () => {
    const chips = buildActiveChips(
      { ...DEFAULT_QUERY, search: 'mu', usageFilter: 'USED', tag: 'hot' },
      t, [], onRemove,
    )
    const keys = chips.map((c) => c.key)
    expect(keys).toEqual(expect.arrayContaining(['search', 'usageFilter', 'tag']))
    chips.find((c) => c.key === 'usageFilter').onRemove()
    expect(onRemove).toHaveBeenCalledWith('usageFilter', 'ALL')
  })

  it('chip thư mục hiển thị tên thư mục khi tra được id', () => {
    const chips = buildActiveChips(
      { ...DEFAULT_QUERY, folderFilter: 'f1' }, t, [{ id: 'f1', name: 'Banner' }], onRemove,
    )
    expect(chips.find((c) => c.key === 'folderFilter').label).toContain('Banner')
  })
})
