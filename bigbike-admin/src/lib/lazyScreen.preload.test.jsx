import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { lazyScreen } from './lazyScreen'

describe('lazyScreen preloading', () => {
  it('uses one import promise for repeated hover preloads and the eventual screen render', async () => {
    const factory = vi.fn(async () => ({
      ExampleScreen: () => <div>Đã tải màn hình</div>,
    }))
    const ExampleScreen = lazyScreen(factory, 'ExampleScreen')

    ExampleScreen.preload()
    ExampleScreen.preload()
    expect(factory).toHaveBeenCalledTimes(1)

    render(
      <Suspense fallback={<div>Đang tải</div>}>
        <ExampleScreen />
      </Suspense>,
    )

    expect(await screen.findByText('Đã tải màn hình')).toBeInTheDocument()
    expect(factory).toHaveBeenCalledTimes(1)
  })
})
