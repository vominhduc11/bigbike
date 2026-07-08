import { describe, it, expect } from 'vitest'
import { createProductSchema } from './schemas'

// Stub i18n: return the defaultValue when provided, otherwise the raw key —
// enough for asserting on error *paths*, which is what these tests check.
const t = (key, opts) => opts?.defaultValue ?? key

function baseForm(overrides = {}) {
  return {
    slug: 'test-product',
    name: 'Test Product',
    categoryId: 'cat-1',
    brandId: 'brand-1',
    gender: 'Unisex',
    sku: 'TEST-SKU',
    retailPrice: '100000',
    publishStatus: 'DRAFT',
    imageUrl: '',
    variants: [],
    translations: { en: { name: 'Test Product EN' } },
    ...overrides,
  }
}

function pathsOf(result) {
  if (result.success) return []
  return result.error.issues.map((i) => i.path.join('.'))
}

describe('createProductSchema — PRODUCT_RULE_005 required-field matrix', () => {
  it('no variants / draft: name-slug-category-brand-gender-sku-retailPrice always required, isCreate not needed', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({
      slug: '', name: '', categoryId: '', brandId: '', gender: '', sku: '', retailPrice: '',
    }))
    expect(result.success).toBe(false)
    const paths = pathsOf(result)
    expect(paths).toEqual(expect.arrayContaining([
      'slug', 'name', 'categoryId', 'brandId', 'gender', 'sku', 'retailPrice',
    ]))
    // Draft must NOT require the main image.
    expect(paths).not.toContain('imageUrl')
  })

  it('no variants / draft complete (image still blank): passes', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm())
    expect(result.success).toBe(true)
  })

  it('no variants / publish: image becomes required too', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({ publishStatus: 'PUBLISHED', imageUrl: '' }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('imageUrl')
  })

  it('no variants / publish complete (with image): passes', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({ publishStatus: 'PUBLISHED', imageUrl: '/media/x.jpg' }))
    expect(result.success).toBe(true)
  })

  it('editing an existing product (isCreate=false) still enforces the same core fields (bug fix)', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({ brandId: '' }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('brandId')
  })

  it('has variants: product-level retailPrice is NOT required, but sku IS required', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      sku: '',
      retailPrice: '',
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '100000', imageUrl: '' }],
    }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('sku')
    expect(pathsOf(result)).not.toContain('retailPrice')
  })

  it('has variants / draft: each real variant still requires its own sku + retailPrice, but not imageUrl', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '',
      variants: [{ name: 'Đỏ - M', sku: '', retailPrice: '' }],
    }))
    expect(result.success).toBe(false)
    const paths = pathsOf(result)
    expect(paths).toEqual(expect.arrayContaining(['variants.0.sku', 'variants.0.retailPrice']))
    expect(paths).not.toContain('variants.0.imageUrl')
  })

  it('PRODUCT_RULE_013 (2026-07-07): a variant with no retailPrice falls back to a valid product-level shared retailPrice — not required', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '100000', // valid shared price at product level
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '' }],
    }))
    expect(result.success).toBe(true)
  })

  it('PRODUCT_RULE_013: a variant with no retailPrice AND no valid shared product retailPrice is still flagged', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '', // no shared price to fall back to
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '' }],
    }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('variants.0.retailPrice')
  })

  it('PRODUCT_RULE_013: a variant salePrice without its own retailPrice is rejected (would be silently ignored)', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '100000', // valid shared price — variant retailPrice itself is optional
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '', salePrice: '50000' }],
    }))
    expect(result.success).toBe(false)
    const paths = pathsOf(result)
    expect(paths).toContain('variants.0.salePrice')
    // Omitting its own retailPrice is fine on its own — only the stray salePrice is the problem.
    expect(paths).not.toContain('variants.0.retailPrice')
  })

  it('has variants / publish: each real variant also requires its own imageUrl', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '', publishStatus: 'PUBLISHED', imageUrl: '/media/main.jpg',
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '100000', imageUrl: '' }],
    }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toContain('variants.0.imageUrl')
  })

  it('has variants / publish complete: passes', () => {
    const schema = createProductSchema(t, true)
    const result = schema.safeParse(baseForm({
      retailPrice: '', publishStatus: 'PUBLISHED', imageUrl: '/media/main.jpg',
      variants: [{ name: 'Đỏ - M', sku: 'VAR-1', retailPrice: '100000', imageUrl: '/media/red.jpg' }],
    }))
    expect(result.success).toBe(true)
  })

  it('an empty variants array behaves like "no variants" (sku/retailPrice required at product level)', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({ sku: '', retailPrice: '', variants: [] }))
    expect(result.success).toBe(false)
    expect(pathsOf(result)).toEqual(expect.arrayContaining(['sku', 'retailPrice']))
  })

  it('shortDescription/description are never required, draft or publish', () => {
    const schema = createProductSchema(t, false)
    const result = schema.safeParse(baseForm({
      publishStatus: 'PUBLISHED', imageUrl: '/media/x.jpg', shortDescription: '', description: '',
    }))
    expect(result.success).toBe(true)
  })
})
