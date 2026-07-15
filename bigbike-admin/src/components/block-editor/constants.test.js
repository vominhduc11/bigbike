import { describe, expect, it } from 'vitest'
import { CONTENT_MENU, PRODUCT_MENU, createBlock } from './constants'

describe('BlockEditor video vocabulary', () => {
  it('chỉ cho phép thêm khối video ở bài viết, không nằm trong menu mô tả sản phẩm', () => {
    expect(CONTENT_MENU.map((item) => item.type)).toContain('video')
    expect(PRODUCT_MENU.map((item) => item.type)).not.toContain('video')
  })

  it('khởi tạo khối video với YouTube làm lựa chọn mặc định', () => {
    expect(createBlock('video')).toMatchObject({
      type: 'video',
      provider: 'youtube',
      url: '',
      caption: '',
    })
  })
})
