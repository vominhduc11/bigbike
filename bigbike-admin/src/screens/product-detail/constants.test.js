import { describe, it, expect } from 'vitest'
import { computeAttrSetWarning, resolveColorChangeMedia } from './constants'

// Stub i18n: return defaultValue when provided, else the raw key — đủ để khẳng định hành vi.
const t = (key, opts) => opts?.defaultValue ?? key

function variant({ key = 'k', name = '', options = [], gallery = [], imageUrl = '', ...rest } = {}) {
  return { _key: key, name, options, gallery, imageUrl, ...rest }
}

function opt(name, value) {
  return { name, value }
}

describe('computeAttrSetWarning — khóa chuẩn thuộc tính màu', () => {
  it('coi "Màu"/"màu sắc"/"Color" là cùng một thuộc tính; giá trị màu khác nhau vẫn hợp lệ', () => {
    const items = [
      variant({ key: 'a', name: 'Đen - S', options: [opt('Màu', 'Đen'), opt('Size', 'S')] }),
      variant({ key: 'b', name: 'Đen bóng - M', options: [opt('màu sắc', 'Đen bóng'), opt('Size', 'M')] }),
      variant({ key: 'c', name: 'Trắng - L', options: [opt('Color', 'Trắng'), opt('Size', 'L')] }),
    ]
    expect(computeAttrSetWarning(items, t)).toBeNull()
  })

  it('báo thiếu khi một biến thể có "Màu" còn biến thể khác chỉ có "Size"', () => {
    const items = [
      variant({ key: 'a', name: 'Đen', options: [opt('Màu', 'Đen')] }),
      variant({ key: 'b', name: 'S', options: [opt('Size', 'S')] }),
    ]
    const warn = computeAttrSetWarning(items, t)
    expect(warn).not.toBeNull()
    expect(warn.offenders.length).toBeGreaterThan(0)
    // Biến thể chỉ có Size (index 2) thiếu thuộc tính màu; nhãn hiển thị là tên gốc dễ hiểu, không phải "__color__".
    const sizeOnly = warn.offenders.find((o) => o.index === 2)
    expect(sizeOnly).toBeDefined()
    expect(sizeOnly.missing).toContain('Màu')
    expect(warn.attrs).not.toContain('__color__')
  })

  it('khác hoa/thường và dấu tiếng Việt không tạo lỗi giả', () => {
    const items = [
      variant({ key: 'a', name: 'Đen', options: [opt('MÀU', 'Đen')] }),
      variant({ key: 'b', name: 'Trắng', options: [opt('màu', 'Trắng')] }),
    ]
    expect(computeAttrSetWarning(items, t)).toBeNull()
  })

  it('trả null khi chưa khai thuộc tính nào', () => {
    expect(computeAttrSetWarning([variant({ key: 'a', options: [] })], t)).toBeNull()
  })
})

describe('resolveColorChangeMedia — giữ/kế thừa ảnh khi đổi giá trị màu', () => {
  const current = variant({
    key: 'v1',
    options: [opt('Màu', 'Đen bóng')],
    gallery: [{ _key: 'g1', mediaType: 'image', url: '/media/den-1.jpg' }],
    imageUrl: '/media/den-cover.jpg',
    imageAlt: 'Đen',
    imageWidth: 800,
    imageHeight: 600,
    imageMimeType: 'image/jpeg',
  })

  it('nhóm màu đích CHƯA có biến thể khác → giữ media hiện có của biến thể', () => {
    const items = [current]
    const media = resolveColorChangeMedia(current, items, 'v1', 'den bong')
    expect(media.imageUrl).toBe('/media/den-cover.jpg')
    expect(media.imageAlt).toBe('Đen')
    expect(media.imageWidth).toBe(800)
    expect(media.gallery).toHaveLength(1)
    expect(media.gallery[0].url).toBe('/media/den-1.jpg')
    // cloneGallery → object mới, không chia sẻ tham chiếu.
    expect(media.gallery[0]).not.toBe(current.gallery[0])
  })

  it('nhóm màu đích ĐÃ có biến thể khác mang media → kế thừa media nhóm đích', () => {
    const sibling = variant({
      key: 'v2',
      options: [opt('Màu', 'Đen bóng')],
      gallery: [{ _key: 'g9', mediaType: 'image', url: '/media/sibling.jpg' }],
      imageUrl: '/media/sibling-cover.jpg',
      imageAlt: 'Sibling',
      imageWidth: 1000,
      imageHeight: 1000,
      imageMimeType: 'image/png',
    })
    const items = [current, sibling]
    const media = resolveColorChangeMedia(current, items, 'v1', 'den bong')
    expect(media.imageUrl).toBe('/media/sibling-cover.jpg')
    expect(media.imageAlt).toBe('Sibling')
    expect(media.gallery[0].url).toBe('/media/sibling.jpg')
  })

  it('bỏ hẳn thuộc tính màu (nextColorKey rỗng) → media trống', () => {
    const media = resolveColorChangeMedia(current, [current], 'v1', '')
    expect(media.imageUrl).toBe('')
    expect(media.gallery).toEqual([])
    expect(media.imageWidth).toBeNull()
  })
})
