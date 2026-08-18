import { describe, expect, it, vi } from 'vitest'
import {
  attachProfileToPrompt,
  buildCategoryProfile,
  buildProductProfile,
  createProductAiPromptBuilder,
} from './aiContentProfile'

const categoryForm = {
  id: 'helmet-category',
  slug: 'mu-bao-hiem',
  name: 'Mũ bảo hiểm',
  introContent: '<div class="bb-cat-intro"><h2 class="bb-ci-h2">Nội dung hiện tại</h2></div>',
  translations: { en: { name: 'Helmets', slug: 'helmets', introContent: '' } },
}

describe('dynamic AI content profiles', () => {
  it('builds a category profile from fresh facets with 17 products and five brands', async () => {
    const profile = await buildCategoryProfile({
      categoryId: 'helmet-category',
      lang: 'vi',
      form: categoryForm,
      currentItem: { id: 'helmet-category', slug: 'mu-bao-hiem', name: 'Mũ bảo hiểm', introContent: '<p>Saved intro</p>' },
      fetchCategoryDetail: vi.fn().mockResolvedValue({ item: { ...categoryForm, introContent: '<p>Fresh saved intro</p>' } }),
      fetchCategoryTree: vi.fn().mockResolvedValue({ items: [
        { id: 'fullface', parentId: 'helmet-category', slug: 'mu-fullface', name: 'Mũ fullface' },
      ] }),
      fetchCatalogFacets: vi.fn().mockResolvedValue({
        resultCount: 17,
        brands: [
          { label: 'ILM', count: 6 },
          { label: 'Caberg', count: 3 },
          { label: 'LS2', count: 3 },
          { label: 'NIC', count: 3 },
          { label: 'AGV', count: 2 },
        ],
        priceRange: { minPrice: 1000000, maxPrice: 9000000 },
      }),
    })

    expect(profile.data.resultCount).toBe(17)
    expect(profile.data.brands).toHaveLength(5)
    expect(profile.lines.join('\n')).toContain('17')
    expect(profile.lines.join('\n')).toContain('ILM')
    expect(profile.lines.join('\n')).toContain('AGV')
    expect(profile.lines.join('\n')).toContain('Mũ fullface')
    expect(profile.lines.join('\n')).toContain('Nội dung hiện tại')
  })

  it('uses fresh product metadata but keeps current draft content for the clicked block', async () => {
    const fetchProductDetail = vi.fn().mockResolvedValue({ item: {
      id: 'helmet-1',
      name: 'Fresh helmet name',
      sku: 'FRESH-SKU',
      brand: { name: 'ILM' },
      categories: [{ id: 'helmet-category', name: 'Mũ bảo hiểm', slug: 'mu-bao-hiem' }],
      price: { retailPrice: 2500000, salePrice: 2200000 },
      variants: [{ sku: 'FRESH-M', isAvailable: true, options: [{ name: 'Cỡ', value: 'M' }] }],
      specifications: '<table><tr><th>Trọng lượng</th><td>1.450 g</td></tr></table>',
    } })
    const profile = await buildProductProfile({
      productId: 'helmet-1',
      lang: 'vi',
      blockType: 'sizeGuide',
      form: {
        name: 'Draft helmet name',
        sku: 'DRAFT-SKU',
        retailPrice: '2500000',
        salePrice: '2200000',
        categoryIds: ['helmet-category'],
        variants: [{ sku: 'DRAFT-M', name: 'M', isAvailable: true, options: [{ name: 'Cỡ', value: 'M' }] }],
        sizeGuideSection: { html: '<table><tr><td>Draft size</td></tr></table>' },
      },
      categoryOptions: [{ id: 'helmet-category', name: 'Mũ bảo hiểm', slug: 'mu-bao-hiem' }],
      brandName: 'ILM',
      fetchProductDetail,
    })

    expect(fetchProductDetail).toHaveBeenCalledWith('helmet-1')
    expect(profile.lines.join('\n')).toContain('Fresh helmet name')
    expect(profile.lines.join('\n')).toContain('FRESH-SKU')
    expect(profile.lines.join('\n')).toContain('Draft size')
    expect(profile.lines.join('\n')).toContain('FRESH-M')
  })

  it('adds technical specifications to the four dependent product blocks', async () => {
    const form = { specifications: '<table><tr><td>ECE 22.06</td></tr></table>', faqs: [], positiveNotes: [], negativeNotes: [], specStats: '', trustBadges: '' }
    for (const blockType of ['highlights', 'faqs', 'specStats', 'trustBadges']) {
      const profile = await buildProductProfile({ productId: null, lang: 'vi', blockType, form })
      expect(profile.lines.join('\n')).toContain('Thông số kỹ thuật hiện có')
      expect(profile.lines.join('\n')).toContain('ECE 22.06')
    }
  })

  it('marks missing facts explicitly for an unsaved product', async () => {
    const profile = await buildProductProfile({ productId: null, lang: 'en', blockType: 'sizeGuide', form: {} })
    expect(profile.lines.join('\n')).toContain('not available yet')
  })

  it('makes prompts different for different products while keeping the shared rules', async () => {
    const builder = createProductAiPromptBuilder({
      productId: null,
      lang: 'vi',
      form: { name: 'Mũ A', sku: 'A-1' },
      fetchProductDetail: vi.fn(),
    })
    const first = await builder('sizeGuide', 'Tạo bảng cỡ')
    const second = attachProfileToPrompt('Tạo bảng cỡ', { type: 'product', lines: ['- Tên sản phẩm: Mũ B', '- Mã sản phẩm: B-2'] }, 'vi')
    expect(first).toContain('Mũ A')
    expect(second).toContain('Mũ B')
    expect(first).not.toBe(second)
    expect(first).toContain('Cấm nhớ, tự suy ra hoặc bịa')
  })
})
