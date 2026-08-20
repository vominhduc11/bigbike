import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError, downloadMedia, mapValidationErrors } from './adminApi'

describe('mapValidationErrors', () => {
  it('giữ Retry-After để UI có thể hướng dẫn thử lại thay vì tự lặp vô hạn', () => {
    const error = new ApiClientError('Bạn thao tác quá nhanh.', 429, 'RATE_LIMIT_EXCEEDED', [], 12)

    expect(error.status).toBe(429)
    expect(error.retryAfterSeconds).toBe(12)
  })

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
      statusCode: 'Hệ thống chỉ hỗ trợ mã 301 hoặc 410; hãy bỏ cấu hình kiểu chuyển hướng cũ.',
    })
  })

  it('dịch mã phản hồi redirect không hợp lệ', () => {
    const error = new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
      { field: 'statusCode', code: 'INVALID_STATUS_CODE', message: 'Redirect status code must be 301 or 410.' },
    ])

    expect(mapValidationErrors(error)).toEqual({
      statusCode: 'Mã phản hồi chỉ có thể là 301 hoặc 410.',
    })
  })
})

describe('downloadMedia', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:media-download')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('fetches the authenticated blob, uses Content-Disposition filename, and downloads without a new tab', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Disposition': "attachment; filename*=UTF-8''%E1%BA%A3nh%20g%E1%BB%91c.png" }),
      blob: vi.fn().mockResolvedValue(new Blob(['original-bytes'], { type: 'image/png' })),
    }
    fetch.mockResolvedValue(response)

    await downloadMedia('media-1', 'fallback.png')

    expect(fetch).toHaveBeenCalledWith('/api/v1/admin/media/media-1/download', expect.objectContaining({
      method: 'GET',
      headers: { Accept: 'application/octet-stream' },
    }))
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
    const anchor = HTMLAnchorElement.prototype.click.mock.instances[0]
    expect(anchor.download).toBe('ảnh gốc.png')
    expect(anchor.target).toBe('')
  })
})
