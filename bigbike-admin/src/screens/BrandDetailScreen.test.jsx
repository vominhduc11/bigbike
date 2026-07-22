import { describe, expect, it } from 'vitest'
import { getBrandRequiredProgress, toBrandPayload } from './brandPayload'

function formWithSeo(overrides = {}) {
  return {
    slug: 'ls2',
    name: 'LS2',
    description: '',
    showOnHomepage: true,
    logoUrl: '',
    bannerUrl: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    translations: { en: { description: '', seoTitle: '', seoDescription: '' } },
    ...overrides,
  }
}

describe('BrandDetailScreen toPayload', () => {
  it('gửi khối SEO rỗng rõ ràng để xóa dữ liệu cũ', () => {
    expect(toBrandPayload(formWithSeo()).seo).toEqual({
      title: null,
      description: null,
      canonicalUrl: null,
      ogImage: null,
    })
  })

  it('giữ nội dung mô tả ảnh chia sẻ khi có ảnh', () => {
    expect(toBrandPayload(formWithSeo({
      seoOgImageUrl: '/media/brands/ls2.jpg',
      seoOgImageAlt: 'Logo thương hiệu LS2',
    })).seo.ogImage).toEqual({
      url: '/media/brands/ls2.jpg',
      alt: 'Logo thương hiệu LS2',
    })
  })

  it('không gửi tên hoặc slug tiếng Anh riêng cho thương hiệu', () => {
    const payload = toBrandPayload(formWithSeo({
      name: 'Hevik',
      translations: { en: { description: 'English description' } },
    }))
    expect(payload.translations.en).not.toHaveProperty('name')
    expect(payload.translations.en).not.toHaveProperty('slug')
    expect(payload.translations.en.description).toBe('English description')
  })

  it('gửi cờ hiện ở trang chủ và không gửi cờ thùng rác', () => {
    const payload = toBrandPayload(formWithSeo({ showOnHomepage: false }))
    expect(payload.showOnHomepage).toBe(false)
    expect(payload).not.toHaveProperty('visible')
  })
})

describe('BrandDetailScreen required progress', () => {
  it('chỉ tính tên dùng chung và slug vì thương hiệu không có tên tiếng Anh riêng', () => {
    expect(getBrandRequiredProgress(formWithSeo({ translations: { en: {} } }))).toEqual({
      filled: 2,
      total: 2,
    })
  })

  it('đủ tiến độ khi có tên dùng chung và slug', () => {
    expect(getBrandRequiredProgress(formWithSeo())).toEqual({
      filled: 2,
      total: 2,
    })
  })
})
