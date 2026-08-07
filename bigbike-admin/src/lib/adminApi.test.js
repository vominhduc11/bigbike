import { describe, expect, it } from 'vitest'
import { ApiClientError, mapValidationErrors } from './adminApi'

describe('mapValidationErrors', () => {
  it('dịch lỗi slug trùng sang tiếng Việt dễ hiểu', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'slug', code: 'DUPLICATE', message: 'Slug is already in use.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      slug: 'Đường dẫn này đã được dùng. Hãy mở bản ghi đang có hoặc đổi đường dẫn khác.',
    })
  })

  it('dịch lỗi slug tiếng Anh trùng sang tiếng Việt dễ hiểu', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'translations.en.slug', code: 'DUPLICATE', message: 'English slug is already in use.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      'translations.en.slug': 'Đường dẫn tiếng Anh này đã được dùng. Hãy đổi đường dẫn tiếng Anh hoặc để trống.',
    })
  })

  it('dịch lỗi tự trỏ (self-loop) của redirect sang tiếng Việt', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'targetUrl', code: 'SELF_LOOP', message: 'Redirect target must differ from the source pattern.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      targetUrl: 'Địa chỉ mới không được trùng với địa chỉ cũ.',
    })
  })

  it('dịch lỗi vòng lặp chuyển hướng (redirect loop) sang tiếng Việt', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'targetUrl', code: 'REDIRECT_LOOP', message: 'Redirect would create a loop: /a → … → /a' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      targetUrl: 'Địa chỉ mới đang tạo vòng lặp chuyển hướng. Hãy chọn địa chỉ khác.',
    })
  })

  it('dịch lỗi trỏ ra ngoài (external target) sang tiếng Việt', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'targetUrl', code: 'EXTERNAL_TARGET', message: 'External redirect targets are not allowed. Use a relative path starting with \'/\'.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      targetUrl: 'Địa chỉ mới phải thuộc website này — không được trỏ sang trang bên ngoài.',
    })
  })

  it('dịch lỗi URL đích không an toàn (unsafe target) sang tiếng Việt', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'targetUrl', code: 'UNSAFE_TARGET', message: 'Protocol-relative URLs are not allowed as redirect targets. Use a path starting with \'/\'.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      targetUrl: 'Địa chỉ mới chưa đúng. Hãy nhập đường dẫn trong website, bắt đầu bằng dấu "/" (ví dụ /sp/).',
    })
  })

  it('dịch lỗi địa chỉ nguồn sai định dạng sang tiếng Việt', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'sourcePattern', code: 'INVALID_SOURCE', message: 'Source must be an internal path.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      sourcePattern: 'Địa chỉ cũ phải là đường dẫn trong website, không gồm tên miền, query hoặc dấu #.',
    })
  })

  it('giải thích rõ cấu hình kiểu chuyển hướng cũ không còn được hỗ trợ', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'statusCode', code: 'UNSUPPORTED', message: 'Managed redirects always use HTTP 301.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      statusCode: 'Hệ thống chỉ hỗ trợ chuyển hướng vĩnh viễn 301; hãy bỏ cấu hình kiểu chuyển hướng cũ.',
    })
  })
})
