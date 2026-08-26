import { describe, it, expect } from 'vitest'
import { createBrandSchema, createCategorySchema, createContentSchema, createProductSchema } from './schemas'

// Stub i18n: return the defaultValue when provided, otherwise the raw key —
// enough for asserting on error *paths*, which is what these tests check.
const t = (key, opts) => opts?.defaultValue ?? key

function baseForm(overrides = {}) {
  return {
    slug: 'test-product',
    name: 'Test Product',
    categoryIds: ['cat-1'],
    brandId: 'brand-1',
    genders: ['Nam'],
    sku: 'TEST-SKU',
    retailPrice: '100000',
    publishStatus: 'DRAFT',
    imageUrl: '',
    variants: [],
    translations: { en: { name: 'Test Product EN' } },
    ...overrides,
  }
}

function pathsOf(result) {
  if (result.success) return []
  return result.error.issues.map((i) => i.path.join('.'))
}

describe('MEDIA_RULE_004 — writable video sources', () => {
  it('product videos and gallery accept the three approved external sources and internal upload', () => {
    const schema = createProductSchema(t, false)
    const valid = schema.safeParse(baseForm({
      videos: [
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: '', type: 'youtube' },
        { url: 'https://www.tiktok.com/@x/video/7412345678901234567', title: '', type: 'tiktok' },
        { url: 'https://www.facebook.com/x/videos/123', title: '', type: 'facebook' },
        { url: '/media/videos/demo.mp4', title: '', type: 'upload' },
      ],
      gallery: [
        { mediaType: 'video', videoUrl: '/media/videos/gallery.mp4', provider: 'upload', url: '', alt: '' },
        { mediaType: 'video', videoUrl: 'https://www.facebook.com/x/videos/123', provider: 'facebook', url: '', alt: '' },
      ],
    }))
    expect(valid.success).toBe(true)

    const rejected = schema.safeParse(baseForm({
      videos: [
        { url: 'https://youtu.be/dQw4w9WgXcQ', title: '', type: 'youtube' },
      ],
      gallery: [
        { mediaType: 'video', videoUrl: 'https://fb.watch/abc', provider: 'facebook', url: '', alt: '' },
      ],
    }))
    expect(pathsOf(rejected)).toEqual(expect.arrayContaining(['videos.0.url', 'gallery.0.videoUrl']))
  })

  it('article video blocks accept the same approved sources', () => {
    const schema = createContentSchema(t, true, 'article')
    const base = {
      slug: 'article-video',
      title: 'Bài viết video',
      excerpt: '',
      body: '',
      publishStatus: 'DRAFT',
      translations: { en: { title: 'Video article' } },
    }

    for (const block of [
      { type: 'video', provider: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { type: 'video', provider: 'upload', url: '/media/videos/article.mp4' },
      { type: 'video', provider: 'tiktok', url: 'https://www.tiktok.com/@x/video/7412345678901234567' },
      { type: 'video', provider: 'facebook', url: 'https://www.facebook.com/x/videos/123' },
    ]) {
      expect(schema.safeParse({ ...base, bodyBlocks: [block] }).success).toBe(true)
    }

    expect(pathsOf(schema.safeParse({ ...base, bodyBlocks: [{ type: 'video', provider: 'tiktok', url: 'https://vt.tiktok.com/short' }] }))).toContain('bodyBlocks.0.url')
  })
})

describe('SEO_RULE_009 — SEO fields are plain text', () => {
  it('rejects HTML in Vietnamese and English SEO fields', () => {
    const product = createProductSchema(t, false).safeParse(baseForm({
      seoTitle: '<strong>Title</strong>',
      seoDescription: '<p>Description</p>',
      translations: { en: { name: 'Test Product EN', seoTitle: '<b>Title</b>', seoDescription: '<div>Description</div>' } },
    }))
    const paths = pathsOf(product)
    expect(paths).toEqual(expect.arrayContaining([
      'seoTitle', 'seoDescription', 'translations.en.seoTitle', 'translations.en.seoDescription',
    ]))

    const category = createCategorySchema(t).safeParse({
      slug: 'category', name: 'Danh mục',
      seoTitle: '<em>Danh mục</em>', seoDescription: '<p>Mô tả</p>',
      translations: { en: { name: 'Category', seoTitle: '<em>Category</em>', seoDescription: '<p>Description</p>' } },
    })
    expect(pathsOf(category)).toEqual(expect.arrayContaining([
      'seoTitle', 'seoDescription', 'translations.en.seoTitle', 'translations.en.seoDescription',
    ]))

    const brand = createBrandSchema(t).safeParse({
      slug: 'brand', name: 'Brand', seoTitle: '<b>Brand</b>', seoDescription: '<p>Description</p>',
      translations: { en: { seoTitle: '<b>Brand</b>', seoDescription: '<p>Description</p>' } },
    })
    expect(pathsOf(brand)).toEqual(expect.arrayContaining([
      'seoTitle', 'seoDescription', 'translations.en.seoTitle', 'translations.en.seoDescription',
    ]))

    const content = createContentSchema(t, true, 'article').safeParse({
      slug: 'article', title: 'Bài viết', excerpt: '', body: '<p>Nội dung</p>', publishStatus: 'DRAFT',
      seoTitle: '<b>Title</b>', seoDescription: '<p>Description</p>',
      translations: { en: { title: 'Article', seoTitle: '<b>Title</b>', seoDescription: '<p>Description</p>' } },
    })
    expect(pathsOf(content)).toEqual(expect.arrayContaining([
      'seoTitle', 'seoDescription', 'translations.en.seoTitle', 'translations.en.seoDescription',
    ]))
  })
})

describe('createProductSchema — PRODUCT_RULE_005 required-field matrix', () => {
  it('no variants / draft: name-slug-category-brand-sku-retailPrice always required, isCreate not needed', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({
      slug: '', name: '', categoryIds: [], brandId: '', genders: [], sku: '', retailPrice: '',
    }))
    expect(result.success).toBe(false)
    const paths = pathsOf(result)
    expect(paths).toEqual(expect.arrayContaining([
      'slug', 'name', 'categoryIds', 'brandId', 'sku', 'retailPrice',
    ]))
    expect(paths).not.toContain('gender')
    // Draft must NOT require the main image.
    expect(paths).not.toContain('imageUrl')
  })

  it('no variants / draft complete (image still blank): passes', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm())
    expect(result.success).toBe(true)
  })

  it('cho phép bỏ trống giới tính hoặc chọn đồng thời Nam và Nữ', () => {
    const schema = createProductSchema(t, false)
    expect(schema.safeParse(baseForm({ genders: [] })).success).toBe(true)
    expect(schema.safeParse(baseForm({ genders: ['Nam', 'Nữ'] })).success).toBe(true)
  })

  it('no variants / publish: image becomes required too', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({ publishStatus: 'PUBLISHED', imageUrl: '' }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('imageUrl')
  })

  it('no variants / publish complete (with image): passes', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({ publishStatus: 'PUBLISHED', imageUrl: '/media/x.jpg' }))
    expect(result.success).toBe(true)
  })

  it('editing an existing product (isCreate=false) still enforces the same core fields (bug fix)', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({ brandId: '' }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('brandId')
  })

  it('has variants: product-level retailPrice is NOT required, but sku IS required', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      sku: '',
      retailPrice: '',
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '100000', imageUrl: '' }],
    }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('sku')
    expect(pathsOf(result)).not.toContain('retailPrice')
  })

  it('has variants / draft: each real variant still requires its own sku + retailPrice, but not imageUrl', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '',
      variants: [{ name: 'Đỏ - M', sku: '', retailPrice: '' }],
    }))
    expect(result.success).toBe(false)
    const paths = pathsOf(result)
    expect(paths).toEqual(expect.arrayContaining(['variants.0.sku', 'variants.0.retailPrice']))
    expect(paths).not.toContain('variants.0.imageUrl')
  })

  it('PRODUCT_RULE_013 (2026-07-07): a variant with no retailPrice falls back to a valid product-level shared retailPrice — not required', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '100000', // valid shared price at product level
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '' }],
    }))
    expect(result.success).toBe(true)
  })

  it('PRODUCT_RULE_013: a variant with no retailPrice AND no valid shared product retailPrice is still flagged', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '', // no shared price to fall back to
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '' }],
    }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('variants.0.retailPrice')
  })

  it('PRODUCT_RULE_013: a variant salePrice without its own retailPrice is rejected (would be silently ignored)', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '100000', // valid shared price — variant retailPrice itself is optional
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '', salePrice: '50000' }],
    }))
    expect(result.success).toBe(false)
    const paths = pathsOf(result)
    expect(paths).toContain('variants.0.salePrice')
    // Omitting its own retailPrice is fine on its own — only the stray salePrice is the problem.
    expect(paths).not.toContain('variants.0.retailPrice')
  })

  it('has variants / publish: a COLOR variant requires its own imageUrl', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '', publishStatus: 'PUBLISHED', imageUrl: '/media/main.jpg',
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '100000', imageUrl: '',
        options: [{ name: 'Màu sắc', value: 'Đỏ', attributeValueId: 'color-red' }, { name: 'Size', value: 'M', attributeValueId: 'size-m' }] }],
    }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('variants.0.imageUrl')
  })

  it('PRODUCT_RULE_005 (fix 2026-07-11): a SIZE-ONLY variant (no color) does NOT require imageUrl on publish', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '', publishStatus: 'PUBLISHED', imageUrl: '/media/main.jpg',
      variants: [{ name: 'M', sku: 'VAR-1', retailPrice: '100000', imageUrl: '',
        options: [{ name: 'Size', value: 'M', attributeValueId: 'size-m' }] }],
    }))
    expect(result.success).toBe(true)
    expect(pathsOf(result)).not.toContain('variants.0.imageUrl')
  })

  it('has variants / publish complete: passes', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '', publishStatus: 'PUBLISHED', imageUrl: '/media/main.jpg',
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '100000', imageUrl: '/media/red.jpg',
        options: [{ name: 'Màu sắc', value: 'Đỏ', attributeValueId: 'color-red' }, { name: 'Size', value: 'M', attributeValueId: 'size-m' }] }],
    }))
    expect(result.success).toBe(true)
  })

  it('requires a dictionary value id on every non-empty option and points to that exact row', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      variants: [{ name: 'M', sku: 'VAR-1', retailPrice: '100000',
        options: [{ name: 'Size', value: 'M' }] }],
    }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('variants.0.options.0.attributeValueId')
  })

  it('an empty variants array behaves like "no variants" (sku/retailPrice required at product level)', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({ sku: '', retailPrice: '', variants: [] }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toEqual(expect.arrayContaining(['sku', 'retailPrice']))
  })

  it('shortDescription/description are never required, draft or publish', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({
      publishStatus: 'PUBLISHED', imageUrl: '/media/x.jpg', shortDescription: '', description: '',
    }))
    expect(result.success).toBe(true)
  })

  it('cho phép Ưu/Nhược điểm tới 20000 ký tự — khớp giới hạn backend (HighlightRequest.java) và product-template', () => {
    const schema = createProductSchema(t, false)
    const longContent = 'x'.repeat(20000)
    const valid = schema.safeParse(baseForm({
      positiveNotes: [{ content: longContent, contentEn: longContent }],
      negativeNotes: [{ content: 'Nhẹ', contentEn: 'Lightweight' }],
    }))
    const tooLong = schema.safeParse(baseForm({
      positiveNotes: [{ content: `${longContent}x`, contentEn: '' }],
    }))

    expect(valid.success).toBe(true)
    expect(tooLong.success).toBe(false)
    expect(pathsOf(tooLong)).toContain('positiveNotes.0.content')
  })
})

describe('createBrandSchema — BRAND_RULE_001/003 shared name and slug', () => {
  it('không yêu cầu tên tiếng Anh riêng cho thương hiệu', () => {
    const schema = createBrandSchema(t)
    const result = schema.safeParse({
      slug: 'hevik',
      name: 'Hevik',
      translations: { en: { name: '' } },
    })

    expect(result.success).toBe(true)
  })

  it('không validate slug tiếng Anh riêng cho thương hiệu', () => {
    const schema = createBrandSchema(t)
    const result = schema.safeParse({
      slug: 'hevik',
      name: 'Hevik',
      translations: { en: { slug: 'Invalid English Slug !!!' } },
    })

    expect(result.success).toBe(true)
  })
})

describe('createCategorySchema — CATEGORY_RULE_001 and TRANSLATION_RULE_002', () => {
  const categoryForm = (overrides = {}) => ({
    slug: 'e2e-category',
    name: 'Danh mục thử nghiệm',
    translations: { en: { name: 'Test category', slug: '' } },
    ...overrides,
  })

  it('requires the English category name while keeping the English slug optional', () => {
    const schema = createCategorySchema(t)
    expect(schema.safeParse(categoryForm()).success).toBe(true)

    const missingEnglishName = schema.safeParse(categoryForm({ translations: { en: { name: '', slug: '' } } }))
    expect(missingEnglishName.success).toBe(false)
    expect(pathsOf(missingEnglishName)).toContain('translations.en.name')
  })

  it('accepts a blank SEO block and validates media separately by role', () => {
    const schema = createCategorySchema(t)
    const valid = schema.safeParse(categoryForm({
      seoTitle: '', seoDescription: '', seoCanonicalUrl: '', seoOgImageUrl: '',
      imageUrl: 'https://cdn.example.test/category.jpg', imageAlt: 'Ảnh danh mục',
      bannerImageUrl: 'https://cdn.example.test/banner.jpg', bannerImageAlt: 'Banner desktop',
      mobileBannerImageUrl: 'https://cdn.example.test/banner-mobile.jpg', mobileBannerImageAlt: 'Banner mobile',
      heroImageUrl: 'https://cdn.example.test/hero.jpg', heroImageAlt: 'Minh họa hero',
      menuIconUrl: 'https://cdn.example.test/menu.svg',
    }))

    expect(valid.success).toBe(true)
  })
})
