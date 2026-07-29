import { describe, it, expect } from 'vitest'
import {
  buildCategoryChildrenSet,
  buildCategoryParentPathMap,
  buildCategoryPathMap,
  buildCategoryTreeOrder,
  buildVisibleCategoryTreeRows,
  buildFormFromItem,
  cleanDescriptionBlocks,
  computeAttrSetWarning,
  getPublishReadiness,
  resolveColorChangeMedia,
  toPayload,
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

describe('media metadata round-trip', () => {
  const item = {
    id: 'product-1',
    sku: 'AGV-K1S',
    slug: 'mu-agv-k1s',
    name: 'Mũ AGV K1S',
    shortDescription: 'Mũ fullface đạt chuẩn ECE 22.06.',
    description: '',
    brandId: 'brand-agv',
    categories: [{ id: 'helmet', name: 'Mũ bảo hiểm' }],
    price: { retailPrice: 5900000, salePrice: 5500000 },
    available: true,
    publishStatus: 'DRAFT',
    image: {
      rawUrl: '/media/product-main.jpg',
      alt: 'Mũ AGV K1S màu đen',
      width: 1200,
      height: 1200,
      mimeType: 'image/jpeg',
    },
    seo: {
      title: 'Mũ AGV K1S',
      description: 'Mô tả SEO',
      ogImage: {
        rawUrl: '/media/product-og.png',
        alt: 'Ảnh chia sẻ AGV K1S',
        width: 1200,
        height: 630,
        mimeType: 'image/png',
      },
    },
    gallery: [
      {
        mediaType: 'image',
        rawUrl: '/media/gallery-1.webp',
        alt: 'Mặt trước mũ',
        width: 1600,
        height: 1200,
        mimeType: 'image/webp',
      },
      {
        mediaType: 'video',
        videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
        provider: 'youtube',
        rawUrl: '/media/video-poster.jpg',
        alt: 'Video giới thiệu mũ',
        width: 1280,
        height: 720,
        mimeType: 'image/jpeg',
      },
    ],
    variants: [{
      id: 'variant-black',
      sku: 'AGV-K1S-BLACK',
      name: 'Đen',
      price: { retailPrice: 5900000, salePrice: 5500000 },
      isAvailable: true,
      options: [{ name: 'Màu', value: 'Đen' }],
      image: {
        url: '/media/variant-black.png',
        alt: 'Mũ màu đen',
        width: 900,
        height: 900,
        mimeType: 'image/png',
      },
      gallery: [{
        mediaType: 'image',
        rawUrl: '/media/variant-gallery.jpg',
        alt: 'Chi tiết màu đen',
        width: 1000,
        height: 800,
        mimeType: 'image/jpeg',
      }],
    }],
    translations: { en: { name: 'AGV K1S Helmet' } },
  }

  it('giữ nguyên metadata ảnh chính, OG, gallery và biến thể khi chỉ mở rồi lưu', () => {
    const payload = toPayload(buildFormFromItem(item))

    expect(payload.image).toEqual({
      url: '/media/product-main.jpg',
      alt: 'Mũ AGV K1S màu đen',
      width: 1200,
      height: 1200,
      mimeType: 'image/jpeg',
    })
    expect(payload.seo.ogImage).toEqual({
      url: '/media/product-og.png',
      alt: 'Ảnh chia sẻ AGV K1S',
      width: 1200,
      height: 630,
      mimeType: 'image/png',
    })
    expect(payload.gallery).toEqual([
      {
        mediaType: 'image',
        url: '/media/gallery-1.webp',
        alt: 'Mặt trước mũ',
        width: 1600,
        height: 1200,
        mimeType: 'image/webp',
        sortOrder: 0,
      },
      {
        mediaType: 'video',
        videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
        videoProvider: 'youtube',
        url: '/media/video-poster.jpg',
        alt: 'Video giới thiệu mũ',
        width: 1280,
        height: 720,
        mimeType: 'image/jpeg',
        sortOrder: 1,
      },
    ])
    expect(payload.variants[0]).toEqual(expect.objectContaining({
      imageUrl: '/media/variant-black.png',
      imageAlt: 'Mũ màu đen',
      imageWidth: 900,
      imageHeight: 900,
      imageMimeType: 'image/png',
      gallery: [{
        mediaType: 'image',
        url: '/media/variant-gallery.jpg',
        alt: 'Chi tiết màu đen',
        width: 1000,
        height: 800,
        mimeType: 'image/jpeg',
        sortOrder: 0,
      }],
    }))
  })

  it('xoá URL thì không gửi lại metadata ảnh cũ', () => {
    const form = buildFormFromItem(item)
    form.imageUrl = ''
    form.seoOgImageUrl = ''
    form.gallery[0].url = ''

    const payload = toPayload(form)
    expect(payload.image).toBeNull()
    expect(payload.seo.ogImage).toBeNull()
    expect(payload.gallery).toHaveLength(1)
    expect(payload.gallery[0].mediaType).toBe('video')
  })

  it('không tự đổi nguồn legacy thành YouTube và không phát sinh payload TikTok/Facebook', () => {
    const legacyItem = structuredClone(item)
    legacyItem.videos = [{
      url: 'https://www.tiktok.com/@bigbike/video/7412345678901234567',
      provider: 'tiktok',
      title: 'Legacy TikTok',
    }]
    legacyItem.gallery[1].provider = 'facebook'
    legacyItem.gallery[1].videoUrl = 'https://www.facebook.com/bigbike/videos/123456789'

    const form = buildFormFromItem(legacyItem)
    expect(form.videos[0].type).toBe('')
    expect(form.gallery[1].provider).toBe('')

    const payload = toPayload(form)
    expect(JSON.stringify(payload)).not.toMatch(/tiktok|facebook/i)
    expect(payload.videos).toHaveLength(0)
    expect(payload.gallery.some((item) => item.mediaType === 'video')).toBe(false)
  })
})

describe('description block media metadata', () => {
  it('giữ cả alt tiếng Việt và tiếng Anh cho khối ảnh và khối feature', () => {
    const blocks = cleanDescriptionBlocks([
      {
        _key: 'image-1',
        type: 'image',
        url: '/media/detail.jpg',
        alt: 'Chi tiết sản phẩm',
        altEn: 'Product detail',
      },
      {
        _key: 'feature-1',
        type: 'feature',
        url: '/media/feature.jpg',
        alt: 'Lớp lót',
        altEn: 'Liner',
        heading: 'Thoáng khí',
        items: ['Êm', ''],
        itemsEn: ['Comfortable', ''],
      },
    ])

    expect(blocks[0]).toEqual(expect.objectContaining({
      alt: 'Chi tiết sản phẩm',
      altEn: 'Product detail',
    }))
    expect(blocks[1]).toEqual(expect.objectContaining({
      alt: 'Lớp lót',
      altEn: 'Liner',
      items: ['Êm'],
      itemsEn: ['Comfortable'],
    }))
  })
})

describe('publish readiness — mục phân loại hệ thống', () => {
  function readyForm(overrides = {}) {
    return {
      name: 'Mũ AGV K1S',
      slug: 'mu-agv-k1s',
      sku: 'AGV-K1S',
      categoryIds: ['helmet'],
      brandId: 'brand-agv',
      gender: 'Unisex',
      imageUrl: '/media/main.jpg',
      retailPrice: '5900000',
      variants: [],
      translations: { en: { name: 'AGV K1S Helmet' } },
      ...overrides,
    }
  }

  it('chặn đăng bán khi danh mục hoặc thương hiệu vẫn là mục Chưa phân loại', () => {
    const categoryItems = getPublishReadiness(readyForm({ categoryIds: ['uncategorized'] }), t)
    const brandItems = getPublishReadiness(readyForm({ brandId: 'uncategorized-brand' }), t)

    expect(categoryItems.find((entry) => entry.id === 'category')?.ok).toBe(false)
    expect(brandItems.find((entry) => entry.id === 'brand')?.ok).toBe(false)
  })
})
