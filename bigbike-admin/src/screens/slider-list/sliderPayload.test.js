import { describe, expect, it } from 'vitest'
import { buildSliderPayload, validateSliderLinkGroup } from './sliderPayload'

const t = (key) => key

function baseForm(overrides = {}) {
  return {
    location: 'home',
    sortOrder: '2',
    desktopImageUrl: '',
    legacyMobileImage: null,
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

  it('chuyển nguyên ảnh mobile legacy để không mất khi sửa toàn phần', () => {
    const legacy = { url: '/media/sliders/hero-mobile.jpg', alt: 'cũ' }
    expect(buildSliderPayload(baseForm({ legacyMobileImage: legacy })).mobileImage).toEqual(legacy)
  })

  it('không gửi mobileImage khi không có dữ liệu legacy', () => {
    expect(buildSliderPayload(baseForm())).not.toHaveProperty('mobileImage')
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
