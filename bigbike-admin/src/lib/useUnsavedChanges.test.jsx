import { StrictMode, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useUnsavedChanges } from './useUnsavedChanges'
import { confirmNavigation, registerNavGuard } from './navigationGuard'

function Editor({ name, initiallyDirty = false }) {
  const [dirty, setDirty] = useState(initiallyDirty)
  const clearOwnGuard = useUnsavedChanges(dirty, name)
  return (
    <>
      <button onClick={() => setDirty(!dirty)}>{name}-toggle</button>
      <button onClick={clearOwnGuard}>{name}-clear</button>
    </>
  )
}

afterEach(() => vi.restoreAllMocks())

describe('editor-owned navigation guards', () => {
  it('keeps the dirty editor registered when a clean editor mounts or unmounts', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const view = render(
      <>
        <Editor name="banner" initiallyDirty />
        <Editor name="shop" />
      </>,
    )
    expect(confirmNavigation()).toBe(false)
    view.rerender(
      <>
        <Editor name="banner" initiallyDirty />
      </>,
    )
    expect(confirmNavigation()).toBe(false)
    expect(confirm).toHaveBeenLastCalledWith('banner')
  })

  it('clears only the editor that saved, including its unload registration', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <>
        <Editor name="banner" initiallyDirty />
        <Editor name="shop" initiallyDirty />
      </>,
    )
    fireEvent.click(screen.getByText('banner-clear'))
    expect(confirmNavigation()).toBe(false)
    expect(confirm).toHaveBeenLastCalledWith('shop')
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    fireEvent.click(screen.getByText('shop-clear'))
    expect(confirmNavigation()).toBe(true)
    const cleanUnload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(cleanUnload)
    expect(cleanUnload.defaultPrevented).toBe(false)
  })

  it('unmounting one dirty editor leaves the other dirty editor protected', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const view = render(
      <>
        <Editor key="banner" name="banner" initiallyDirty />
        <Editor key="shop" name="shop" initiallyDirty />
      </>,
    )
    view.rerender(
      <>
        <Editor key="shop" name="shop" initiallyDirty />
      </>,
    )
    expect(confirmNavigation()).toBe(true)
    expect(confirm).toHaveBeenLastCalledWith('shop')
  })

  it('supports StrictMode cleanup and a second edit after clearing the first', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <StrictMode>
        <Editor name="banner" />
      </StrictMode>,
    )
    fireEvent.click(screen.getByText('banner-toggle'))
    expect(confirmNavigation()).toBe(false)
    fireEvent.click(screen.getByText('banner-toggle'))
    expect(confirmNavigation()).toBe(true)
    fireEvent.click(screen.getByText('banner-toggle'))
    expect(confirmNavigation()).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('uses the latest getter and disposing twice cannot remove another owner', () => {
    let dirty = false
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const dispose = registerNavGuard(() => dirty, 'first')
    const disposeOther = registerNavGuard(() => true, 'other')
    act(() => {
      dirty = true
    })
    expect(confirmNavigation()).toBe(false)
    expect(confirm).toHaveBeenLastCalledWith('first')
    dispose()
    dispose()
    expect(confirmNavigation()).toBe(false)
    expect(confirm).toHaveBeenLastCalledWith('other')
    disposeOther()
  })
})
