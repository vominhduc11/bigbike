import { describe, expect, it } from 'vitest'
import { buildSliderPayload, validateSliderLinkGroup } from './sliderPayload'

const t = (key) => key

function baseForm(overrides = {}) {
  return {
    location: 'home',
    sortOrder: '2',
    desktopImageUrl: '',
    mobileImageUrl: '',
    mobileImageAlt: '',
    externalLink: '',
    productId: '',
    isActive: true,
    ...overrides,
  }
}

describe('buildSliderPayload', () => {
  it('ép sortOrder về số và bỏ link/sản phẩm rỗng', () => {
    const payload = buildSliderPayload(baseForm({ sortOrder: '3' }))
    expect(payload.sortOrder).toBe(3)
    expect(payload.externalLink).toBeUndefined()
    expect(payload.productId).toBeUndefined()
    expect(payload).not.toHaveProperty('desktopImage')
  })

  it('chỉ gửi ảnh desktop khi có URL', () => {
    const payload = buildSliderPayload(baseForm({ desktopImageUrl: '  /media/sliders/hero.jpg ' }))
    expect(payload.desktopImage).toEqual({ url: '/media/sliders/hero.jpg' })
  })

  it('gửi rõ URL và alt của ảnh mobile', () => {
    expect(buildSliderPayload(baseForm({
      mobileImageUrl: '  /media/sliders/hero-mobile.jpg ',
      mobileImageAlt: '  Banner mobile mùa hè ',
    })).mobileImage).toEqual({
      url: '/media/sliders/hero-mobile.jpg',
      alt: 'Banner mobile mùa hè',
    })
  })

  it('giữ ảnh mobile cũ khi form sửa được lưu mà không thay đổi', () => {
    const form = baseForm({
      mobileImageUrl: '/media/sliders/hero-mobile-cu.jpg',
      mobileImageAlt: 'Ảnh mobile cũ',
    })
    expect(buildSliderPayload(form).mobileImage).toEqual({
      url: '/media/sliders/hero-mobile-cu.jpg',
      alt: 'Ảnh mobile cũ',
    })
  })

  it('gửi mobileImage null khi ảnh mobile bị xóa hoặc banner mới không có ảnh mobile', () => {
    expect(buildSliderPayload(baseForm()).mobileImage).toBeNull()
    expect(buildSliderPayload(baseForm({
      mobileImageUrl: '   ',
      mobileImageAlt: 'Alt không được giữ khi thiếu URL',
    })).mobileImage).toBeNull()
  })

  it('gửi alt null khi ảnh mobile không có alt', () => {
    expect(buildSliderPayload(baseForm({
      mobileImageUrl: '/media/sliders/hero-mobile.jpg',
    })).mobileImage).toEqual({
      url: '/media/sliders/hero-mobile.jpg',
      alt: null,
    })
  })
})

describe('validateSliderLinkGroup', () => {
  it('bắt buộc có link ngoài hoặc sản phẩm', () => {
    expect(validateSliderLinkGroup(baseForm(), t)).toBe('sliders.formRequired')
  })

  it('chấp nhận khi chỉ có sản phẩm', () => {
    expect(validateSliderLinkGroup(baseForm({ productId: 'prod_1' }), t)).toBe('')
  })

  it('chấp nhận link ngoài an toàn (https)', () => {
    expect(validateSliderLinkGroup(baseForm({ externalLink: 'https://bigbike.vn/khuyen-mai' }), t)).toBe('')
  })

  it('chặn link ngoài không an toàn (javascript:)', () => {
    expect(validateSliderLinkGroup(baseForm({ externalLink: 'javascript:alert(1)' }), t))
      .toBe('sliders.formExternalLinkInvalid')
  })
})
