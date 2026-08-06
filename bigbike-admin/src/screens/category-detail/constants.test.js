import { describe, expect, it } from 'vitest'
import { buildEmptyForm, toPayload } from './constants'

describe('Category payload contract', () => {
  it('omits the default homepage placement on create and never sends visibility', () => {
    const payload = toPayload(buildEmptyForm(), { isCreate: true })

    expect(payload).not.toHaveProperty('showOnHomepage')
    expect(payload).not.toHaveProperty('visible')
  })

  it('persists homepage placement independently on update', () => {
    const payload = toPayload({ ...buildEmptyForm(), showOnHomepage: false })

    expect(payload.showOnHomepage).toBe(false)
    expect(payload).not.toHaveProperty('visible')
  })

  // canonicalUrl không còn được gửi từ form: SEO_RULE_003 — canonical tự sinh từ slug
  // theo locale ở tầng web, ô nhập tay đã gỡ (2026-08-06) vì web chưa bao giờ đọc nó.
  // noIndex/noIndexEn thêm ở V371 — cờ cho-Google-hiển-thị tách riêng VI/EN (SEO_RULE_001).
  it('always sends an explicit SEO block and normalizes blank values to null', () => {
    expect(toPayload(buildEmptyForm()).seo).toEqual({
      title: null,
      description: null,
      noIndex: false,
      noIndexEn: false,
      ogImage: null,
    })
  })

  it('gửi cờ cho-Google-hiển-thị tách riêng cho từng ngôn ngữ', () => {
    const payload = toPayload({ ...buildEmptyForm(), seoNoIndex: true, seoNoIndexEn: false })
    expect(payload.seo.noIndex).toBe(true)
    expect(payload.seo.noIndexEn).toBe(false)
  })

  it('không còn gửi canonicalUrl từ form (SEO_RULE_003)', () => {
    expect(toPayload(buildEmptyForm()).seo).not.toHaveProperty('canonicalUrl')
  })

  it('keeps the alt text of each persisted media role separate', () => {
    const payload = toPayload({
      ...buildEmptyForm(),
      imageUrl: '/media/category-thumb.jpg', imageAlt: 'Ảnh thumbnail',
      heroImageUrl: '/media/category-hero.jpg', heroImageAlt: 'Ảnh hero',
      bannerImageUrl: '/media/category-banner.jpg', bannerImageAlt: 'Ảnh banner',
      mobileBannerImageUrl: '/media/category-banner-mobile.jpg', mobileBannerImageAlt: 'Ảnh banner mobile',
    })

    expect(payload.image.alt).toBe('Ảnh thumbnail')
    expect(payload.icon.alt).toBe('Ảnh hero')
    expect(payload.banner.alt).toBe('Ảnh banner')
    expect(payload.mobileBanner.alt).toBe('Ảnh banner mobile')
  })

  it('luôn gửi mô tả và khối giới thiệu kể cả khi rỗng để admin xóa được nội dung cũ', () => {
    const payload = toPayload({ ...buildEmptyForm(), description: '', introContent: '' })

    expect(payload).toHaveProperty('description')
    expect(payload).toHaveProperty('introContent')
    expect(payload.description).toBe('')
    expect(payload.introContent).toBe('')
  })

  it('gửi đúng nội dung mô tả và khối giới thiệu đã nhập', () => {
    const payload = toPayload({
      ...buildEmptyForm(),
      description: '  <p>Mũ bảo hiểm fullface</p>  ',
      introContent: '  <p>Giới thiệu danh mục</p>  ',
    })

    expect(payload.description).toBe('<p>Mũ bảo hiểm fullface</p>')
    expect(payload.introContent).toBe('<p>Giới thiệu danh mục</p>')
  })

  it('gửi rỗng ảnh thành url null để xóa từng vai trò ảnh riêng biệt', () => {
    const payload = toPayload(buildEmptyForm())

    expect(payload.image).toEqual({ url: null })
    expect(payload.banner).toEqual({ url: null })
    expect(payload.mobileBanner).toEqual({ url: null })
    expect(payload.icon).toEqual({ url: null })
    expect(payload.menuIcon).toEqual({ url: null })
  })
})
