import { describe, it, expect } from 'vitest'
import {
  buildCategoryChildrenSet,
  buildCategoryParentPathMap,
  buildCategoryPathMap,
  buildCategoryTreeOrder,
  buildVisibleCategoryTreeRows,
  computeAttrSetWarning,
  resolveColorChangeMedia,
} from './constants'

// Stub i18n: return defaultValue when provided, else the raw key — đủ để khẳng định hành vi.
const t = (key, opts) => opts?.defaultValue ?? key

function variant({ key = 'k', name = '', options = [], gallery = [], imageUrl = '', ...rest } = {}) {
  return { _key: key, name, options, gallery, imageUrl, ...rest }
}

function opt(name, value) {
  return { name, value }
}

describe('category tree helpers — danh mục nhiều cấp', () => {
  const categories = [
    { id: 'root', name: 'Phụ kiện', parentId: null },
    { id: 'child', name: 'Phụ kiện đồ lót', parentId: 'root' },
    { id: 'sibling', name: 'Áo mưa', parentId: 'root' },
    { id: 'grandchild', name: 'Áo lót', parentId: 'child' },
    { id: 'great-grandchild', name: 'Áo lót mùa hè', parentId: 'grandchild' },
  ]

  it('sắp xếp depth-first và giữ đúng cấp con của danh mục con', () => {
    const tree = buildCategoryTreeOrder(categories)
    expect(tree.map((item) => [item.id, item.depth])).toEqual([
      ['root', 0],
      ['child', 1],
      ['grandchild', 2],
      ['great-grandchild', 3],
      ['sibling', 1],
    ])
  })

  it('chỉ hiện cấp cháu khi toàn bộ cha phía trên đang mở', () => {
    const tree = buildCategoryTreeOrder(categories)

    expect(buildVisibleCategoryTreeRows(tree, new Set()).map((item) => item.id)).toEqual(['root'])
    expect(buildVisibleCategoryTreeRows(tree, new Set(['root'])).map((item) => item.id)).toEqual([
      'root',
      'child',
      'sibling',
    ])
    expect(buildVisibleCategoryTreeRows(tree, new Set(['root', 'child'])).map((item) => item.id)).toEqual([
      'root',
      'child',
      'grandchild',
      'sibling',
    ])
    expect(buildVisibleCategoryTreeRows(tree, new Set(['root', 'child', 'grandchild'])).map((item) => item.id)).toEqual([
      'root',
      'child',
      'grandchild',
      'great-grandchild',
      'sibling',
    ])
  })

  it('đánh dấu mọi danh mục có con ở bất kỳ cấp nào', () => {
    const tree = buildCategoryTreeOrder(categories)
    expect([...buildCategoryChildrenSet(tree)].sort()).toEqual(['child', 'grandchild', 'root'])
  })

  it('tạo đường dẫn đầy đủ và đường dẫn cha cho danh mục cấp sâu', () => {
    const fullPath = buildCategoryPathMap(categories)
    const parentPath = buildCategoryParentPathMap(categories)

    expect(fullPath.get('great-grandchild')).toBe('Phụ kiện › Phụ kiện đồ lót › Áo lót › Áo lót mùa hè')
    expect(parentPath.get('great-grandchild')).toBe('Phụ kiện › Phụ kiện đồ lót › Áo lót')
    expect(parentPath.get('root')).toBe('')
  })
})

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
