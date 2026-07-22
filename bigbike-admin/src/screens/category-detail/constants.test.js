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

  it('always sends an explicit SEO block and normalizes blank values to null', () => {
    expect(toPayload(buildEmptyForm()).seo).toEqual({
      title: null,
      description: null,
      canonicalUrl: null,
      ogImage: null,
    })
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
})
