import { describe, expect, it } from 'vitest'
import {
  bannerImageSource,
  bannerPreviewTitle,
  EDITABLE_BANNER_KEYS,
  HERO_SYSTEM_BG,
  HERO_SYSTEM_ILLUSTRATION,
  heroPreviewGeometry,
  resolveBannerPreviewUrl,
} from './bannerSettings'
import { evaluateImageDimensions, IMAGE_RECO } from '@/lib/imageRecommendations'

describe('banner display contract', () => {
  it.each([
    ['/wp-content/themes/bigbike/images/page-title-bg.png', '/brand/page-title-bg.png'],
    [
      'https://bigbike.vn/wp-content/themes/bigbike/images/page-title-bg.png?v=2',
      '/brand/page-title-bg.png',
    ],
    [
      'https://www.bigbike.vn/wp-content/themes/bigbike/images/mu-bao-hiem.png#old',
      '/brand/catalog/mu-bao-hiem.png',
    ],
    ['/wp-content/themes/bigbike/images/mu-bao-hiem.png', '/brand/catalog/mu-bao-hiem.png'],
    ['https://cdn.bigbike.vn/uploads/banner.png', '/wp-content/uploads/banner.png'],
  ])('normalizes legacy display %s without changing the original value', (original, expected) => {
    expect(resolveBannerPreviewUrl(original)).toMatch(
      new RegExp(expected.replaceAll('.', '\\.') + '$'),
    )
    expect(original).not.toBe(expected)
  })

  it('preserves picker URLs and rewrites internal MinIO for the admin proxy', () => {
    expect(resolveBannerPreviewUrl('/media/banner.jpg')).toBe('/media/banner.jpg')
    expect(resolveBannerPreviewUrl('http://minio:9000/bigbike-media/banner.jpg')).toBe(
      '/media-proxy/banner.jpg',
    )
  })

  it('uses own, shared and system assets in that order, including whitespace values', () => {
    expect(bannerImageSource('/media/own.png', '/media/default.png', HERO_SYSTEM_BG)).toEqual({
      src: '/media/own.png',
      source: 'own',
    })
    expect(bannerImageSource(' ', '/media/default.png', HERO_SYSTEM_BG)).toEqual({
      src: '/media/default.png',
      source: 'default',
    })
    expect(bannerImageSource('', '', HERO_SYSTEM_ILLUSTRATION)).toEqual({
      src: resolveBannerPreviewUrl(HERO_SYSTEM_ILLUSTRATION),
      source: 'fallback',
    })
  })

  it('falls back from blank English to the Vietnamese draft and localized default', () => {
    expect(bannerPreviewTitle('Bản nháp VI', '', 'en', 'News')).toBe('Bản nháp VI')
    expect(bannerPreviewTitle('Bản nháp VI', 'English draft', 'en', 'News')).toBe('English draft')
    expect(bannerPreviewTitle(' ', ' ', 'en', 'News')).toBe('News')
    expect(bannerPreviewTitle('', 'English draft', 'vi', 'Tin tức')).toBe('Tin tức')
  })

  it('counts only editable keys, never the retired mobile settings', () => {
    expect(EDITABLE_BANNER_KEYS.size).toBe(14)
    expect([...EDITABLE_BANNER_KEYS].some((key) => key.includes('mobile'))).toBe(false)
  })

  it.each([
    [1440, 450, true],
    [768, 450, true],
    [375, 250, false],
    [767, 250, false],
  ])('scales the storefront composition at %s', (viewport, sourceHeight, desktop) => {
    const geometry = heroPreviewGeometry(viewport, viewport / 2)
    expect(geometry).toMatchObject({ sourceHeight, desktop, scale: 0.5, height: sourceHeight / 2 })
  })

  it('keeps enforced ratios separate from advisory pixel sizes', () => {
    expect(evaluateImageDimensions(1920, 600, IMAGE_RECO.bannerWide)).toEqual(['wrongRatio'])
    expect(evaluateImageDimensions(3840, 900, IMAGE_RECO.bannerWide)).toBeNull()
    expect(evaluateImageDimensions(960, 225, IMAGE_RECO.bannerWide)).toBeNull()
    expect(evaluateImageDimensions(100, 200, IMAGE_RECO.illustration)).toBeNull()
  })
})
