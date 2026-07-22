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
})
