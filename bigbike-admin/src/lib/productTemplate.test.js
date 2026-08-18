import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSizeGuide, parseSizeGuideResult, mergeSizeGuideIntoHtml, serializeSizeGuide } from './sizeChart'
import { mergeSpecsIntoHtml, parseSpecsResult, serializeSpecs } from './specSheet'
import {
  mergeSuitabilityIntoHtml,
  parseSuitabilityResult,
  serializeSuitabilityCards,
} from './suitabilityCards'

const readText = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')
const sample = JSON.parse(readText('../../../product-template/mau-day-du.json'))
const guide = readText('../../../product-template/HUONG-DAN.md')
const locales = {
  vi: JSON.parse(readText('../locales/vi.json')),
  en: JSON.parse(readText('../locales/en.json')),
}

const parseDocument = (html) => new DOMParser().parseFromString(html, 'text/html')
const stylesFor = (html, selector) => [...parseDocument(html).querySelectorAll(selector)].map((element) => element.getAttribute('style'))
const normalizedGuide = guide.replace(/\s+/g, ' ')

const sizeFixture = {
  columns: [{ label: 'Size' }, { label: 'Vòng đầu (cm)' }],
  rows: [{ cells: ['M', '57–58'] }],
  note: 'Ghi chú nếu có.',
}

describe('product-template canonical HTML contract', () => {
  it('mẫu JSON hợp lệ và cả hai sản phẩm mở được bằng biểu mẫu', () => {
    expect(Object.keys(sample)).toEqual(['0', '1'])

    Object.values(sample).forEach((product) => {
      expect(product.descriptionBlocks.every((block) => !block.url || block.url.startsWith('/media/'))).toBe(true)
      expect(JSON.stringify(product)).not.toContain('/wp-content/uploads/')
      expect(JSON.stringify(product)).not.toContain('rgb(')
      expect(JSON.stringify(product)).not.toMatch(/font-family:\s*(?:Arial|Oswald)|font-size:\s*\d+px/i)

      for (const language of ['html', 'htmlEn']) {
        const suitabilityHtml = product.suitabilitySection?.[language]
        const sizeHtml = product.sizeGuideSection?.[language]
        if (suitabilityHtml) {
          const result = parseSuitabilityResult(suitabilityHtml)
          expect(result.acceptedCount).toBeGreaterThan(0)
          expect(result.acceptedCount).toBe(product.suitabilitySection[language].match(/<li\b/g).length)
        }
        if (sizeHtml) {
          const result = parseSizeGuideResult(sizeHtml)
          expect(result.acceptedCount).toBeGreaterThan(0)
          expect(result.model.rows.length).toBe(result.acceptedCount)
          expect(parseDocument(sizeHtml).querySelector('thead')).toBeTruthy()
          expect(parseDocument(sizeHtml).querySelector('tbody')).toBeTruthy()
        }
      }

      for (const [field, html] of Object.entries({
        specificationsVI: product.specifications?.specificationsVI,
        specificationsEN: product.specifications?.specificationsEN,
      })) {
        if (!html) continue
        const document = parseDocument(html)
        const table = document.querySelector('table.shop_attributes')
        expect(table, `${product.sku} ${field} must use shop_attributes`).toBeTruthy()
        expect([...document.querySelectorAll('table, th, td')].some((element) => element.hasAttribute('style'))).toBe(false)
        const result = parseSpecsResult(html)
        expect(result.acceptedCount).toBe(document.querySelectorAll('tbody tr').length)
        expect(result.items.length).toBe(result.acceptedCount)
      }

      const structuredHtml = [
        product.specifications?.specificationsVI,
        product.specifications?.specificationsEN,
        product.specStats?.specStatsVI,
        product.specStats?.specStatsEN,
        product.trustBadges?.trustBadgesVI,
        product.trustBadges?.trustBadgesEN,
        product.suitabilitySection?.html,
        product.suitabilitySection?.htmlEn,
        product.sizeGuideSection?.html,
        product.sizeGuideSection?.htmlEn,
      ].filter(Boolean)
      structuredHtml.forEach((html) => {
        const document = parseDocument(html)
        expect(document.querySelector('script, style, [id]')).toBeNull()
      })
    })
  })

  it('khuôn cấu trúc giữ trình bày, còn prompt AI không thêm trình bày', () => {
    const specExamples = {
      vi: '<table class="shop_attributes"><tbody><tr><th scope="row">Tên thông số</th><td>Giá trị</td></tr>...</tbody></table>',
      en: '<table class="shop_attributes"><tbody><tr><th scope="row">Spec name</th><td>Value</td></tr>...</tbody></table>',
    }
    const generatedSpec = serializeSpecs([{ name: 'Tên thông số', value: 'Giá trị' }])
    expect(generatedSpec).toBe('<table class="shop_attributes"><tbody><tr><th scope="row">Tên thông số</th><td>Giá trị</td></tr></tbody></table>')
    expect(locales.vi.products.detail.specs.aiBriefPrompt).toContain(specExamples.vi)
    expect(locales.en.products.detail.specs.aiBriefPrompt).toContain(specExamples.en)
    expect(normalizedGuide).toContain(specExamples.vi)

    const generatedSize = serializeSizeGuide(sizeFixture)
    const generatedSuitability = serializeSuitabilityCards([{ audience: 'Tên đối tượng', advice: 'Lời khuyên' }])
    const generatedSizeStyles = new Set(stylesFor(generatedSize, 'table, th, td, p'))
    const generatedSuitabilityStyles = new Set(stylesFor(generatedSuitability, 'ul, li, strong'))

    for (const language of ['vi', 'en']) {
      const sizePrompt = locales[language].products.detail.sizeGuide.aiBriefPrompt
      const suitabilityPrompt = locales[language].products.detail.suitability.aiBriefPrompt
      expect(sizePrompt).toContain('<table><thead><tr><th>')
      expect(suitabilityPrompt).toContain('<ul class="suitability-list">')
      expect(sizePrompt).not.toContain('style="')
      expect(suitabilityPrompt).not.toContain('style="')
      expect(sizePrompt).not.toContain('var(--bb-')
      expect(suitabilityPrompt).not.toContain('var(--bb-')
    }
    [...generatedSizeStyles]
      .filter((style) => !style.includes('font-weight:700'))
      .forEach((style) => expect(normalizedGuide).toContain(`style="${style}"`))
    expect(normalizedGuide).toContain('cột size (cột đầu tiên) thêm font-weight:700')
    generatedSuitabilityStyles.forEach((style) => expect(normalizedGuide).toContain(`style="${style}"`))

    Object.values(sample).forEach((product) => {
      for (const language of ['html', 'htmlEn']) {
        const sizeHtml = product.sizeGuideSection[language]
        const suitabilityHtml = product.suitabilitySection[language]
        const sampleSizeStyles = new Set(stylesFor(sizeHtml, 'table, th, td, p'))
        const sampleSuitabilityStyles = new Set(stylesFor(suitabilityHtml, 'ul, li, strong'))
        generatedSizeStyles.forEach((style) => expect(sampleSizeStyles).toContain(style))
        generatedSuitabilityStyles.forEach((style) => expect(sampleSuitabilityStyles).toContain(style))
      }
    })
  })

  it('sửa bằng biểu mẫu giữ chữ và định dạng của file mẫu', () => {
    const product = sample['1']
    for (const field of ['specificationsVI', 'specificationsEN']) {
      const html = product.specifications[field]
      const parsed = parseSpecsResult(html)
      const formattedIndex = parsed.items.findIndex(({ value }) => /<(?:strong|em)\b/.test(value))
      expect(formattedIndex).toBeGreaterThanOrEqual(0)
      const edited = parsed.items.map((item) => ({ ...item }))
      const otherIndex = formattedIndex === 0 ? 1 : 0
      edited[otherIndex].value = `${edited[otherIndex].value} (đã sửa)`
      const merged = mergeSpecsIntoHtml(edited, html)
      const after = parseSpecsResult(merged)
      expect(after.items).toHaveLength(parsed.items.length)
      expect(after.items[formattedIndex].value).toBe(parsed.items[formattedIndex].value)
      expect(after.items[otherIndex].value).toContain('(đã sửa)')
    }

    for (const language of ['html', 'htmlEn']) {
      const html = product.suitabilitySection[language]
      const parsed = parseSuitabilityResult(html)
      const edited = parsed.items.map((item) => ({ ...item }))
      edited[0].advice = `${edited[0].advice} (đã sửa)`
      const merged = mergeSuitabilityIntoHtml(edited, html)
      expect(parseSuitabilityResult(merged).items).toHaveLength(parsed.items.length)
      expect(merged).toContain('(đã sửa)')
      expect(merged).toContain('color:var(--bb-text-primary);font-weight:700;')
    }
  })

  it('bảng size ba cột sửa một ô không nhân đôi hoặc làm mất cột còn lại', () => {
    const existing =
      '<table><thead><tr><th>Size</th><th>Giá trị</th><th>Đơn vị</th></tr></thead><tbody><tr><td>M</td><td>1350</td><td>gram</td></tr></tbody></table>'
    const model = parseSizeGuide(existing)
    model.rows[0].cells[1] = '1350 gram'
    const merged = mergeSizeGuideIntoHtml(model, existing)
    const cells = [...parseDocument(merged).querySelectorAll('tbody tr td')].map((cell) => cell.textContent)
    expect(cells).toEqual(['M', '1350 gram', 'gram'])
  })
})
