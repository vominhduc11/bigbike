import { describe, expect, it, vi } from 'vitest'
import { canReloadHighlightsForLanguageChange } from './draftGuard'

describe('Home Highlights content-language draft guard', () => {
  it('keeps the current draft when the editor cancels the language reload', async () => {
    const confirmDiscard = vi.fn().mockResolvedValue(false)

    await expect(canReloadHighlightsForLanguageChange({
      initialized: true,
      isDirty: true,
      confirmDiscard,
    })).resolves.toBe(false)
    expect(confirmDiscard).toHaveBeenCalledOnce()
  })

  it('reloads after the editor explicitly accepts losing the draft', async () => {
    const confirmDiscard = vi.fn().mockResolvedValue(true)

    await expect(canReloadHighlightsForLanguageChange({
      initialized: true,
      isDirty: true,
      confirmDiscard,
    })).resolves.toBe(true)
  })

  it('reloads a clean initialized screen without showing a confirmation', async () => {
    const confirmDiscard = vi.fn()

    await expect(canReloadHighlightsForLanguageChange({
      initialized: true,
      isDirty: false,
      confirmDiscard,
    })).resolves.toBe(true)
    expect(confirmDiscard).not.toHaveBeenCalled()
  })
})
