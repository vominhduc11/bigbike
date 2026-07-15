import { describe, expect, it } from 'vitest'
import { toBrandPayload } from './brandPayload'

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
})
