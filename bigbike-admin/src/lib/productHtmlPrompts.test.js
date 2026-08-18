import { describe, expect, it } from 'vitest'
import vi from '../locales/vi.json'
import en from '../locales/en.json'
import { serializeSizeGuide } from './sizeChart'

const sizeModel = {
  columns: [{ label: 'Size' }, { label: 'Vòng đầu (cm)' }],
  rows: [{ cells: ['M', '57–58'] }],
  note: 'Ghi chú nếu có.',
}

describe('canonical product HTML prompts', () => {
  it.each([
    ['vi', vi.products.detail],
    ['en', en.products.detail],
  ])('%s keeps specifications as website-rendered markup', (_locale, detail) => {
    const prompt = detail.specs.aiBriefPrompt
    expect(prompt).toContain('<table class="shop_attributes"><tbody><tr><th scope="row">')
    expect(prompt).not.toContain('style="')
    expect(prompt).not.toContain('font-family:')
    expect(prompt).not.toContain('#')
  })

  it.each([
    ['vi', vi.products.detail],
    ['en', en.products.detail],
  ])('%s uses the exact tokenized size styles emitted by the form', (_locale, detail) => {
    const prompt = detail.sizeGuide.aiBriefPrompt
    const emittedStyles = [...serializeSizeGuide(sizeModel).matchAll(/style="([^"]+)"/g)].map((match) => match[1])
    emittedStyles.forEach((style) => expect(prompt).toContain(`style="${style}"`))
    expect(prompt).not.toContain('Arial')
    expect(prompt).not.toContain('#dddddd')
    expect(prompt).not.toContain('font-size:16px')
  })
})
