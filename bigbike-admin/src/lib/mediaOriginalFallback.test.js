import { describe, expect, it } from 'vitest'
import { resolveThumbUrl } from './contracts'

describe('ảnh gốc khi không lưu biến thể trùng lặp', () => {
  it.each([undefined, {}, { medium: '/media/source.medium.png' }, { thumb: '' }])(
    'dùng ảnh gốc khi thiếu thumbnail: %j',
    (sizes) => {
      expect(resolveThumbUrl({ publicUrl: '/media/source.png', sizes })).toBe('/media/source.png')
    },
  )

  it('ưu tiên thumbnail thực sự được tạo', () => {
    expect(
      resolveThumbUrl({
        publicUrl: '/media/source.png',
        sizes: { thumb: '/media/source.thumb.png' },
      }),
    ).toBe('/media/source.thumb.png')
  })
})
