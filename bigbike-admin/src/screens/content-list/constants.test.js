import { describe, expect, it } from 'vitest'
import { CONTENT_SORT_OPTIONS, INITIAL_CONTENT_QUERY, isContentActionEligible } from './constants'

describe('content list constants', () => {
  it('mặc định dùng bộ lọc Tất cả và để backend loại bài trong Thùng rác', () => {
    expect(INITIAL_CONTENT_QUERY.publishStatus).toBe('ALL')
  })

  it('có đủ hai chiều sắp xếp cho năm trường được hỗ trợ', () => {
    expect(new Set(CONTENT_SORT_OPTIONS.map(([value]) => value))).toEqual(
      new Set([
        'title:asc',
        'title:desc',
        'publishStatus:asc',
        'publishStatus:desc',
        'createdAt:asc',
        'createdAt:desc',
        'updatedAt:asc',
        'updatedAt:desc',
        'publishedAt:asc',
        'publishedAt:desc',
      ]),
    )
    expect(CONTENT_SORT_OPTIONS).toHaveLength(10)
  })

  it('chỉ cho phép hành động hàng loạt trên trạng thái phù hợp', () => {
    expect(isContentActionEligible({ publishStatus: 'DRAFT' }, 'trash')).toBe(true)
    expect(isContentActionEligible({ publishStatus: 'TRASH' }, 'trash')).toBe(false)
    expect(isContentActionEligible({ publishStatus: 'TRASH' }, 'restore')).toBe(true)
    expect(isContentActionEligible({ publishStatus: 'DRAFT' }, 'restore')).toBe(false)
    expect(isContentActionEligible({ publishStatus: 'TRASH' }, 'permanent')).toBe(true)
  })
})
