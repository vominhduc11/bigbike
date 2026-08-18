import { describe, expect, it } from 'vitest'
import vi from '../locales/vi.json'
import en from '../locales/en.json'
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
  ])('%s keeps size-guide AI output presentation-free', (_locale, detail) => {
    const prompt = detail.sizeGuide.aiBriefPrompt
    expect(prompt).toContain('<table><thead><tr><th>Size</th>')
    expect(prompt).not.toContain('style="')
    expect(prompt).not.toContain('var(--bb-')
    expect(prompt).toMatch(/website owns presentation|website tự áp dụng phần trình bày/)
    expect(prompt).not.toContain('Arial')
    expect(prompt).not.toContain('#dddddd')
    expect(prompt).not.toContain('font-size:16px')
  })
})
