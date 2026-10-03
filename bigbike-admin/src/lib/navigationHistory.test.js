import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { createGuardedHistory } from './navigationHistory'
import { registerNavGuard } from './navigationGuard'

let history
let disposeGuard
beforeEach(() => window.history.replaceState({ existing: 'preserved' }, '', '/admin/dashboard'))
afterEach(() => {
  history?.dispose()
  disposeGuard?.()
  disposeGuard = null
  vi.restoreAllMocks()
})

describe('guarded browser history', () => {
  it('restores a rejected Back without adding entries, then supports accepted Back and Forward', async () => {
    const onChange = vi.fn()
    history = createGuardedHistory(onChange)
    history.navigate('/admin/settings')
    const length = window.history.length
    disposeGuard = registerNavGuard(() => true, 'draft')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    onChange.mockClear()
    window.history.back()
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    await waitFor(() => expect(window.location.pathname).toBe('/admin/settings'))
    expect(window.history.length).toBe(length)
    expect(onChange).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    window.history.back()
    await waitFor(() => expect(window.location.pathname).toBe('/admin/dashboard'))
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    window.history.forward()
    await waitFor(() => expect(window.location.pathname).toBe('/admin/settings'))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    expect(confirm).toHaveBeenCalledTimes(3)
  })

  it('guards programmatic navigation and preserves existing state on replacement', () => {
    history = createGuardedHistory(vi.fn())
    disposeGuard = registerNavGuard(() => true)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(history.navigate('/admin/settings')).toBe(false)
    expect(window.location.pathname).toBe('/admin/dashboard')
    disposeGuard()
    const index = window.history.state.bigbikeHistoryIndex
    history.navigate('/admin/settings', { replace: true })
    expect(window.history.state).toEqual({ existing: 'preserved', bigbikeHistoryIndex: index })
  })
})
