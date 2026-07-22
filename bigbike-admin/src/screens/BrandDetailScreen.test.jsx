import { describe, expect, it } from 'vitest'
import { getBrandRequiredProgress, toBrandPayload } from './brandPayload'

function formWithSeo(overrides = {}) {
  return {
    slug: 'ls2',
    name: 'LS2',
    description: '',
    visible: true,
    logoUrl: '',
    bannerUrl: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    translations: { en: { slug: '', name: 'LS2', description: '', seoTitle: '', seoDescription: '' } },
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

  it('dùng tên thương hiệu chung cho trường tương thích tiếng Anh', () => {
    expect(toBrandPayload(formWithSeo({
      name: 'Hevik',
      translations: { en: { name: '' } },
    })).translations.en.name).toBe('Hevik')
  })

  it('không gửi slug tiếng Anh riêng cho thương hiệu', () => {
    expect(toBrandPayload(formWithSeo({
      translations: { en: { slug: 'hevik-en', name: 'Hevik' } },
    })).translations.en.slug).toBeNull()
  })
})

describe('BrandDetailScreen required progress', () => {
  it('chỉ tính tên dùng chung và slug vì thương hiệu không có tên tiếng Anh riêng', () => {
    expect(getBrandRequiredProgress(formWithSeo({ translations: { en: { name: '' } } }))).toEqual({
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
