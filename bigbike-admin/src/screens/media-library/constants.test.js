import { describe, expect, it, vi } from 'vitest'
import { ALLOWED_MIME, MAX_FILE_SIZE, DEFAULT_QUERY, buildActiveChips } from './constants'

describe('media constants', () => {
  it('cho phép đúng nhóm định dạng ảnh + video mp4, không nhận loại lạ', () => {
    expect(ALLOWED_MIME).toEqual(['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
    expect(ALLOWED_MIME).not.toContain('image/gif')
    expect(ALLOWED_MIME).not.toContain('image/svg+xml')
    expect(ALLOWED_MIME).not.toContain('application/pdf')
    expect(ALLOWED_MIME).not.toContain('text/html')
  })

  it('giới hạn dung lượng client là 200MB theo hợp đồng nghiệp vụ', () => {
    expect(MAX_FILE_SIZE).toBe(200 * 1024 * 1024)
  })

  // Đợt tinh gọn: bỏ hẳn bộ lọc nâng cao (ngày/dung lượng/kích thước) và kiểu xem
  // lưới/bảng. Khoá lại để không ai vô tình thêm lại vào query mặc định.
  it('không còn bộ lọc nâng cao và kiểu xem trong query mặc định', () => {
    for (const key of [
      'uploadedFrom',
      'uploadedTo',
      'minSize',
      'maxSize',
      'minWidth',
      'minHeight',
      'view',
    ]) {
      expect(DEFAULT_QUERY).not.toHaveProperty(key)
    }
  })

  it('giữ đúng bộ lọc cơ bản trong query mặc định', () => {
    expect(Object.keys(DEFAULT_QUERY).sort()).toEqual([
      'dir',
      'folderFilter',
      'mimeType',
      'page',
      'pageSize',
      'search',
      'sort',
      'status',
      'tag',
      'usageFilter',
    ])
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
      t,
      [],
      onRemove,
    )
    const keys = chips.map((c) => c.key)
    expect(keys).toEqual(expect.arrayContaining(['search', 'usageFilter', 'tag']))
    chips.find((c) => c.key === 'usageFilter').onRemove()
    expect(onRemove).toHaveBeenCalledWith('usageFilter', 'ALL')
  })

  it('chip thư mục hiển thị tên thư mục khi tra được id', () => {
    const chips = buildActiveChips(
      { ...DEFAULT_QUERY, folderFilter: 'f1' },
      t,
      [{ id: 'f1', name: 'Banner' }],
      onRemove,
    )
    expect(chips.find((c) => c.key === 'folderFilter').label).toContain('Banner')
  })
})
