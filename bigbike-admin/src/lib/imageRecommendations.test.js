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
    expect(getBrandLogoSourceDecision({ ...validPng, width: 250, height: 108 }))
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

  it('blocks JPG, opaque PNG and files over 300 KB', () => {
    expect(getBrandLogoIssues({ ...validPng, mimeType: 'image/jpeg' })).toContain('NOT_PNG')
    expect(getBrandLogoIssues({ ...validPng, transparent: false })).toContain('NOT_TRANSPARENT')
    expect(getBrandLogoIssues({ ...validPng, fileSize: 300 * 1024 + 1 })).toContain('TOO_LARGE')
  })
})
