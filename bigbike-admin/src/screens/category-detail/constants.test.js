import { describe, expect, it } from 'vitest'
import { buildEmptyForm, buildFormFromItem, getCategoryImageValidationError, toPayload } from './constants'

describe('Category payload contract', () => {
  it('chặn ảnh mới không vuông nhưng cho phép ảnh vuông không có sàn kích thước', () => {
    expect(getCategoryImageValidationError({ imageUrl: '/media/200.jpg', imageWidth: 200, imageHeight: 200 }, null, { isCreate: true })).toBeNull()
    expect(getCategoryImageValidationError({ imageUrl: '/media/300.jpg', imageWidth: 300, imageHeight: 200 }, null, { isCreate: true })).toEqual({
      key: 'categories.detail.imageNotSquare',
      values: { w: 300, h: 200 },
    })
  })

  it('bỏ qua kiểm tra tỉ lệ khi danh mục cũ giữ nguyên URL ảnh không vuông', () => {
    const currentItem = { image: { rawUrl: '/media/old.jpg', width: 39, height: 60 } }
    expect(getCategoryImageValidationError({ imageUrl: '/media/old.jpg', imageWidth: null, imageHeight: null }, currentItem)).toBeNull()
  })

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
    })

    expect(payload.image.alt).toBe('Ảnh thumbnail')
    expect(payload.icon.alt).toBe('Ảnh hero')
    expect(payload.banner.alt).toBe('Ảnh banner')
    expect(payload).not.toHaveProperty('mobileBanner')
  })

  it('giữ metadata ảnh thumbnail, ảnh hero và ảnh chia sẻ qua vòng đọc rồi lưu', () => {
    const form = buildFormFromItem({
      image: { url: '/media/category-thumb.webp', alt: 'Thumbnail', width: 520, height: 520, mimeType: 'image/webp' },
      icon: { url: '/media/category-hero.png', alt: 'Hero', width: 900, height: 800, mimeType: 'image/png' },
      seo: { ogImage: { url: '/media/category-og.jpg', alt: 'OG', width: 1200, height: 630, mimeType: 'image/jpeg' } },
    })
    const payload = toPayload(form)

    expect(payload.image).toEqual({
      url: '/media/category-thumb.webp', alt: 'Thumbnail', width: 520, height: 520, mimeType: 'image/webp',
    })
    expect(payload.icon).toEqual({
      url: '/media/category-hero.png', alt: 'Hero', width: 900, height: 800, mimeType: 'image/png',
    })
    expect(payload.seo.ogImage).toEqual({
      url: '/media/category-og.jpg', alt: 'OG', width: 1200, height: 630, mimeType: 'image/jpeg',
    })
  })

  it('không hydrate hoặc gửi lại field biểu tượng menu legacy', () => {
    const form = buildFormFromItem({
      parentId: 'cat_parent',
      menuIconUrl: '/media/legacy-child-menu.svg',
    })

    expect(form).not.toHaveProperty('menuIconUrl')
    expect(toPayload({ ...form, menuIconUrl: '/media/stale-draft.svg' })).not.toHaveProperty('menuIcon')
  })

  it('luôn gửi mô tả và khối giới thiệu kể cả khi rỗng để admin xoá được nội dung cũ', () => {
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

  it('giữ nguyên HTML nâng cao ở cùng field cho cả VI và English', () => {
    const viHtml = '<p>Bảng cỡ mũ</p><table><tbody><tr><td>M</td></tr></tbody></table>'
    const enHtml = '<p>Helmet size chart</p><table><tbody><tr><td>M</td></tr></tbody></table>'
    const payload = toPayload({
      ...buildEmptyForm(),
      introContent: `  ${viHtml}  `,
      translations: { en: { ...buildEmptyForm().translations.en, introContent: `  ${enHtml}  ` } },
    })

    expect(payload.introContent).toBe(viHtml)
    expect(payload.translations.en.introContent).toBe(enHtml)
  })

  it('gửi rỗng ảnh thành url null để xoá từng vai trò ảnh riêng biệt', () => {
    const payload = toPayload(buildEmptyForm())

    expect(payload.image).toEqual({ url: null })
    expect(payload.banner).toEqual({ url: null })
    expect(payload).not.toHaveProperty('mobileBanner')
    expect(payload.icon).toEqual({ url: null })
    expect(payload).not.toHaveProperty('menuIcon')
  })
})
