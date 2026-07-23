import { describe, expect, it } from 'vitest'
import { ApiClientError, mapValidationErrors } from './adminApi'

describe('mapValidationErrors', () => {
  it('dịch lỗi slug trùng sang tiếng Việt dễ hiểu', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'slug', code: 'DUPLICATE', message: 'Slug is already in use.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      slug: 'Slug này đã được dùng. Hãy mở bản ghi đang có hoặc đổi slug khác.',
    })
  })

  it('dịch lỗi slug tiếng Anh trùng sang tiếng Việt dễ hiểu', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'translations.en.slug', code: 'DUPLICATE', message: 'English slug is already in use.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      'translations.en.slug': 'Slug tiếng Anh này đã được dùng. Hãy đổi slug tiếng Anh hoặc để trống.',
    })
  })

  it('dịch lỗi tự trỏ (self-loop) của redirect sang tiếng Việt', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'targetUrl', code: 'SELF_LOOP', message: 'Redirect target must differ from the source pattern.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      targetUrl: 'URL đích không được trùng với mẫu nguồn.',
    })
  })

  it('dịch lỗi vòng lặp chuyển hướng (redirect loop) sang tiếng Việt', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'targetUrl', code: 'REDIRECT_LOOP', message: 'Redirect would create a loop: /a → … → /a' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      targetUrl: 'URL đích tạo vòng lặp chuyển hướng (trỏ vòng lại chính nó). Hãy chọn URL đích khác.',
    })
  })

  it('dịch lỗi trỏ ra ngoài (external target) sang tiếng Việt', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'targetUrl', code: 'EXTERNAL_TARGET', message: 'External redirect targets are not allowed. Use a relative path starting with \'/\'.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      targetUrl: 'URL đích phải là đường dẫn nội bộ hoặc cùng tên miền với website — không được trỏ ra trang ngoài.',
    })
  })

  it('dịch lỗi URL đích không an toàn (unsafe target) sang tiếng Việt', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'targetUrl', code: 'UNSAFE_TARGET', message: 'Protocol-relative URLs are not allowed as redirect targets. Use a path starting with \'/\'.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      targetUrl: 'URL đích không hợp lệ. Hãy dùng đường dẫn nội bộ bắt đầu bằng "/" (ví dụ /san-pham-moi).',
    })
  })
})
