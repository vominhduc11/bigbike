import { describe, expect, it } from 'vitest'
import { IMAGE_RECO, evaluateImageDimensions } from './imageRecommendations'
import { getBrandLogoIssues, getBrandLogoSourceDecision } from './brandLogoPolicy'

describe('category image dimensions', () => {
  it.each([
    [200, 200],
    [1, 1],
  ])('accepts an exact square without a minimum size: %dx%d', (width, height) => {
    expect(evaluateImageDimensions(width, height, IMAGE_RECO.categoryImage)).toBeNull()
  })

  it.each([
    [300, 200],
    [287, 289],
    [220, 219],
  ])('rejects every non-square image without tolerance: %dx%d', (width, height) => {
    expect(evaluateImageDimensions(width, height, IMAGE_RECO.categoryImage)).toEqual(['wrongRatio'])
  })

  it('keeps the existing tolerance behaviour for other image positions', () => {
    expect(evaluateImageDimensions(285, 289, IMAGE_RECO.productImage)).toBeNull()
    expect(evaluateImageDimensions(300, 200, IMAGE_RECO.productImage)).toEqual(['wrongRatio'])
  })
})

describe('brand logo policy', () => {
  const validPng = {
    width: 800,
    height: 800,
    fileSize: 120 * 1024,
    mimeType: 'image/png',
    transparent: true,
  }

  it('opens the manual square crop for a transparent non-square PNG', () => {
    expect(getBrandLogoSourceDecision({ ...validPng, width: 800, height: 1080 }))
      .toEqual({ needsCrop: true, issues: [] })
  })

  it('accepts a transparent 800×800 PNG without cropping', () => {
    expect(getBrandLogoSourceDecision(validPng)).toEqual({ needsCrop: false, issues: [] })
    expect(getBrandLogoIssues(validPng)).toEqual([])
  })

  it('blocks a square logo below the 400×400 minimum', () => {
    expect(getBrandLogoSourceDecision({ ...validPng, width: 200, height: 200 }))
      .toEqual({ needsCrop: false, issues: ['TOO_SMALL'] })
  })

  it('accepts JPEG and keeps an opaque-background warning non-blocking', () => {
    const issues = getBrandLogoIssues({ ...validPng, mimeType: 'image/jpeg', transparent: false })
    expect(issues).toContain('NOT_TRANSPARENT')
    expect(getBrandLogoSourceDecision({ ...validPng, mimeType: 'image/jpeg', transparent: false }))
      .toEqual({ needsCrop: false, issues: ['NOT_TRANSPARENT'] })
  })

  it('accepts all three image formats and rejects other types', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(getBrandLogoIssues({ ...validPng, mimeType })).not.toContain('UNSUPPORTED_TYPE')
    }
    expect(getBrandLogoIssues({ ...validPng, mimeType: 'image/gif' })).toContain('UNSUPPORTED_TYPE')
  })

  it('allows an oversized non-square source to reach the crop encoder', () => {
    expect(getBrandLogoSourceDecision({ ...validPng, width: 800, height: 1000, fileSize: 300 * 1024 + 1 }))
      .toEqual({ needsCrop: true, issues: [] })
  })

  it('still blocks files over 300 KB after they are already square', () => {
    expect(getBrandLogoSourceDecision({ ...validPng, fileSize: 300 * 1024 + 1 }))
      .toEqual({ needsCrop: false, issues: ['TOO_LARGE'] })
  })

  it('reports opaque PNG as a warning rather than a blocking issue', () => {
    expect(getBrandLogoIssues({ ...validPng, transparent: false })).toContain('NOT_TRANSPARENT')
    expect(getBrandLogoIssues({ ...validPng, fileSize: 300 * 1024 + 1 })).toContain('TOO_LARGE')
  })
})
