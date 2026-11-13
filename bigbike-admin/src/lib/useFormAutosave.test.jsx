import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useFormAutosave } from './useFormAutosave'
import { SESSION_ENDING_EVENT } from './authSession'

afterEach(() => vi.useRealTimers())

it('flushes the latest dirty form before session-driven unmount without waiting ten seconds', () => {
  vi.useFakeTimers()
  const persist = vi.fn()
  const hook = renderHook(({ form, dirty }) => useFormAutosave('product', form, dirty, persist), {
    initialProps: { form: { name: 'first' }, dirty: true },
  })
  hook.rerender({ form: { name: 'just typed' }, dirty: true })
  expect(persist).not.toHaveBeenCalled()
  act(() => window.dispatchEvent(new Event(SESSION_ENDING_EVENT)))
  expect(persist).toHaveBeenCalledExactlyOnceWith('product', { name: 'just typed' })
  hook.unmount()
  act(() => {
    vi.advanceTimersByTime(10_000)
    window.dispatchEvent(new Event(SESSION_ENDING_EVENT))
  })
  expect(persist).toHaveBeenCalledTimes(1)
})

it('flushes on pagehide but never recreates a saved or discarded clean draft', () => {
  const persist = vi.fn()
  const hook = renderHook(
    ({ dirty }) => useFormAutosave('product', { name: 'draft' }, dirty, persist),
    {
      initialProps: { dirty: true },
    },
  )
  act(() => window.dispatchEvent(new Event('pagehide')))
  expect(persist).toHaveBeenCalledTimes(1)
  hook.rerender({ dirty: false })
  act(() => window.dispatchEvent(new Event(SESSION_ENDING_EVENT)))
  expect(persist).toHaveBeenCalledTimes(1)
})
