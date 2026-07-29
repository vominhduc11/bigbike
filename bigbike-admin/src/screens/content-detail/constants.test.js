import { describe, expect, it } from 'vitest'
import { buildEmptyForm, buildFormFromItem, canonicalUrlFromSlug, toPayload } from './constants'
import { createContentSchema, zodErrors } from '../../lib/schemas'

function articleForm(overrides = {}) {
  return {
    ...buildEmptyForm('ARTICLE'),
    slug: 'bai-viet-thu-nghiem',
    title: 'Bài viết thử nghiệm',
    ...overrides,
  }
}

describe('Content payload — ảnh giữ alt, nội dung xoá được', () => {
  it('gửi kèm alt của ảnh bìa và ảnh sản phẩm để không mất chữ admin vừa nhập', () => {
    const payload = toPayload(articleForm({
      coverImageUrl: '/media/articles/cover.jpg',
      coverImageAlt: 'Ảnh bìa bài viết',
      productImageUrl: '/media/articles/product.jpg',
      productImageAlt: 'Ảnh sản phẩm trong bài',
    }), false)

    expect(payload.coverImage).toEqual({
      url: '/media/articles/cover.jpg',
      alt: 'Ảnh bìa bài viết',
      width: null,
      height: null,
      mimeType: null,
    })
    expect(payload.productImage).toEqual({ url: '/media/articles/product.jpg', alt: 'Ảnh sản phẩm trong bài' })
  })

  it('giữ nguyên URL gốc và metadata ảnh bìa, ảnh OG khi admin không thay ảnh', () => {
    const form = buildFormFromItem('ARTICLE', {
      slug: 'bai-viet-thu-nghiem',
      title: 'Bài viết thử nghiệm',
      coverImage: {
        url: 'https://cdn.bigbike.vn/optimized-cover.webp',
        rawUrl: '/media/articles/cover.jpg',
        alt: 'Ảnh bìa gốc',
        width: 1600,
        height: 900,
        mimeType: 'image/jpeg',
      },
      seo: {
        ogImage: {
          url: 'https://cdn.bigbike.vn/optimized-og.webp',
          rawUrl: '/media/articles/og.jpg',
          alt: 'Ảnh OG gốc',
          width: 1200,
          height: 630,
          mimeType: 'image/jpeg',
        },
      },
    })

    const payload = toPayload(form, false)

    expect(payload.coverImage).toEqual({
      url: '/media/articles/cover.jpg',
      alt: 'Ảnh bìa gốc',
      width: 1600,
      height: 900,
      mimeType: 'image/jpeg',
    })
    expect(payload.seo.ogImage).toEqual({
      url: '/media/articles/og.jpg',
      alt: 'Ảnh OG gốc',
      width: 1200,
      height: 630,
      mimeType: 'image/jpeg',
    })
  })

  it('gửi url rỗng để xoá ảnh khi admin bỏ trống', () => {
    const payload = toPayload(articleForm(), false)
    expect(payload.coverImage).toEqual({ url: '' })
    expect(payload.productImage).toEqual({ url: '' })
  })

  it('luôn gửi excerpt kể cả khi rỗng để admin xoá được đoạn tóm tắt cũ', () => {
    const payload = toPayload(articleForm({ excerpt: '' }), false)
    expect(payload).toHaveProperty('excerpt')
    expect(payload.excerpt).toBe('')
  })

  it('gửi đúng đoạn tóm tắt đã nhập (đã cắt khoảng trắng)', () => {
    const payload = toPayload(articleForm({ excerpt: '  Tóm tắt ngắn  ' }), false)
    expect(payload.excerpt).toBe('Tóm tắt ngắn')
  })

  it('luôn gửi khối SEO rõ ràng, chuẩn hoá ô trống thành null', () => {
    const payload = toPayload(articleForm(), false)
    expect(payload.seo).toMatchObject({
      title: null,
      description: null,
      canonicalUrl: canonicalUrlFromSlug('bai-viet-thu-nghiem'),
      ogImage: null,
      noIndex: false,
    })
  })

  it('luôn chuẩn hoá danh mục Tin tức và canonical tiếng Việt theo slug', () => {
    const payload = toPayload(articleForm({ slug: '  xe-moi-2026  ' }), false)

    expect(payload.categoryId).toBe('')
    expect(payload.seo.canonicalUrl).toBe(canonicalUrlFromSlug('xe-moi-2026'))
    expect(payload.seo.canonicalUrl).toMatch(/\/tin-tuc\/xe-moi-2026\/$/)
    expect(canonicalUrlFromSlug('')).toBeNull()
  })

  it('gửi slug tiếng Anh cho bài viết và các field EN chuẩn hoá null khi trống', () => {
    const payload = toPayload(articleForm({
      translations: { en: { slug: 'test-article', title: 'Test article', excerpt: '', body: '', seoTitle: '', seoDescription: '' } },
    }), false)
    expect(payload.translations.en.slug).toBe('test-article')
    expect(payload.translations.en.title).toBe('Test article')
    expect(payload.translations.en.excerpt).toBeNull()
  })
})

describe('Content schema — trường bắt buộc và giới hạn ký tự', () => {
  const t = (key) => key

  function validForm(overrides = {}) {
    return articleForm({
      body: '<p>Nội dung tiếng Việt</p>',
      translations: {
        en: {
          slug: 'test-article',
          title: 'Test article',
          excerpt: '',
          body: '',
          seoTitle: '',
          seoDescription: '',
        },
      },
      ...overrides,
    })
  }

  it('bắt buộc tiêu đề VI, tiêu đề EN và nội dung VI nhưng không bắt nội dung EN', () => {
    const result = createContentSchema(t, true, 'ARTICLE').safeParse(validForm({
      title: '',
      body: '',
      bodyBlocks: null,
      translations: {
        en: { title: '', slug: '', excerpt: '', body: '', seoTitle: '', seoDescription: '' },
      },
    }))
    const errors = zodErrors(result)

    expect(errors.title).toBe('content.detail.errTitleRequired')
    expect(errors['translations.en.title']).toBe('content.detail.errTitleRequiredEn')
    expect(errors.bodyBlocks).toBe('content.detail.errBodyRequired')
    expect(errors).not.toHaveProperty('translations.en.body')
  })

  it('chặn tiêu đề/SEO quá 255 và tóm tắt/mô tả SEO quá 5.000 ký tự', () => {
    const result = createContentSchema(t, true, 'ARTICLE').safeParse(validForm({
      title: 'a'.repeat(256),
      excerpt: 'b'.repeat(5001),
      seoTitle: 'c'.repeat(256),
      seoDescription: 'd'.repeat(5001),
    }))
    const errors = zodErrors(result)

    expect(errors.title).toBe('content.detail.errTitleTooLong')
    expect(errors.excerpt).toBe('content.detail.errExcerptTooLong')
    expect(errors.seoTitle).toBe('content.detail.errSeoTitleTooLong')
    expect(errors.seoDescription).toBe('content.detail.errSeoDescriptionTooLong')
  })
})
