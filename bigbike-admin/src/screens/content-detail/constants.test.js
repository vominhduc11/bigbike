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
  it('giữ alt và mẫu định dạng chú thích khi lưu khối ảnh bài viết', () => {
    const block = {
      _key: 'editor-only',
      type: 'image',
      url: '/media/articles/photo.jpg',
      alt: 'Ảnh chuyến đi',
      caption: 'Đèo Hải Vân',
      captionHtmlTemplate: '<p style="text-align: center"><em>{{caption}}</em></p>',
    }
    const payload = toPayload(articleForm({ bodyBlocks: [block] }), false)
    expect(payload.bodyBlocks).toEqual(
      [{ ...block, _key: undefined }].map(({ _key, ...rest }) => rest),
    )
  })

  it('không gửi lại các khối đã lưu khi chỉ bấm Lưu mà không sửa nội dung', () => {
    const item = {
      slug: 'bai-viet-thu-nghiem',
      title: 'Bài viết thử nghiệm',
      body: '<h2>&nbsp;</h2><p>Nội dung cũ</p>',
      bodyBlocks: [
        { type: 'heading', level: 2, text: '' },
        { type: 'paragraph', html: '<p>Nội dung cũ</p>' },
      ],
    }
    const form = buildFormFromItem('ARTICLE', item)
    const saved = JSON.parse(JSON.stringify(toPayload(form, false)))
    expect(saved).not.toHaveProperty('bodyBlocks')
    expect(saved).not.toHaveProperty('body')

    const changed = {
      ...form,
      bodyBlocks: form.bodyBlocks.map((block, i) =>
        i === 0 ? { ...block, text: 'Tiêu đề mới' } : block,
      ),
    }
    expect(toPayload(changed, false).bodyBlocks).toHaveLength(2)
  })

  it('gửi kèm alt của ảnh bìa và ảnh sản phẩm để không mất chữ admin vừa nhập', () => {
    const payload = toPayload(
      articleForm({
        coverImageUrl: '/media/articles/cover.jpg',
        coverImageAlt: 'Ảnh bìa bài viết',
        productImageUrl: '/media/articles/product.jpg',
        productImageAlt: 'Ảnh sản phẩm trong bài',
      }),
      false,
    )

    expect(payload.coverImage).toEqual({
      url: '/media/articles/cover.jpg',
      alt: 'Ảnh bìa bài viết',
      width: null,
      height: null,
      mimeType: null,
    })
    expect(payload.productImage).toEqual({
      url: '/media/articles/product.jpg',
      alt: 'Ảnh sản phẩm trong bài',
    })
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

  it('không gửi các trường tóm tắt và tên tác giả đã gỡ', () => {
    const payload = toPayload(articleForm(), false)
    expect(payload).not.toHaveProperty('excerpt')
    expect(payload).not.toHaveProperty('authorName')
    expect(payload.translations.en).not.toHaveProperty('excerpt')
    expect(payload.translations.en).not.toHaveProperty('authorName')
  })

  it('gửi cờ bài viết nổi bật do nhân viên chọn tay', () => {
    const payload = toPayload(articleForm({ featured: true }), false)
    expect(payload.featured).toBe(true)
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

  it('không gửi danh mục nội dung và chuẩn hoá canonical tiếng Việt theo slug', () => {
    const payload = toPayload(articleForm({ slug: '  xe-moi-2026  ' }), false)

    expect(payload).not.toHaveProperty('categoryId')
    expect(payload.seo.canonicalUrl).toBe(canonicalUrlFromSlug('xe-moi-2026'))
    expect(payload.seo.canonicalUrl).toMatch(/\/tin-tuc\/xe-moi-2026\/$/)
    expect(canonicalUrlFromSlug('')).toBeNull()
  })

  it('gửi slug tiếng Anh cho bài viết và các field EN chuẩn hoá null khi trống', () => {
    const payload = toPayload(
      articleForm({
        translations: {
          en: {
            slug: 'test-article',
            title: 'Test article',
            body: '',
            seoTitle: '',
            seoDescription: '',
          },
        },
      }),
      false,
    )
    expect(payload.translations.en.slug).toBe('test-article')
    expect(payload.translations.en.title).toBe('Test article')
    expect(payload.translations.en).not.toHaveProperty('excerpt')
  })

  it('gửi lại HTML tiếng Anh nguyên vẹn khi không sửa nội dung', () => {
    const original = ' <p style="text-align: center">Keep&nbsp;spacing</p>\n'
    const form = articleForm({
      translations: { en: { ...buildEmptyForm('ARTICLE').translations.en, body: original } },
    })
    expect(toPayload(form, false).translations.en.body).toBe(original)
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
          body: '',
          seoTitle: '',
          seoDescription: '',
        },
      },
      ...overrides,
    })
  }

  it('bắt buộc tiêu đề VI, tiêu đề EN và nội dung VI nhưng không bắt nội dung EN', () => {
    const result = createContentSchema(t, true, 'ARTICLE').safeParse(
      validForm({
        title: '',
        body: '',
        bodyBlocks: null,
        translations: {
          en: { title: '', slug: '', body: '', seoTitle: '', seoDescription: '' },
        },
      }),
    )
    const errors = zodErrors(result)

    expect(errors.title).toBe('content.detail.errTitleRequired')
    expect(errors['translations.en.title']).toBe('content.detail.errTitleRequiredEn')
    expect(errors.bodyBlocks).toBe('content.detail.errBodyRequired')
    expect(errors).not.toHaveProperty('translations.en.body')
  })

  it('chặn tiêu đề/SEO quá giới hạn ký tự', () => {
    const result = createContentSchema(t, true, 'ARTICLE').safeParse(
      validForm({
        title: 'a'.repeat(256),
        seoTitle: 'c'.repeat(256),
        seoDescription: 'd'.repeat(5001),
      }),
    )
    const errors = zodErrors(result)

    expect(errors.title).toBe('content.detail.errTitleTooLong')
    expect(errors).not.toHaveProperty('excerpt')
    expect(errors).not.toHaveProperty('authorName')
    expect(errors.seoTitle).toBe('content.detail.errSeoTitleTooLong')
    expect(errors.seoDescription).toBe('content.detail.errSeoDescriptionTooLong')
  })
})
