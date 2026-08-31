import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrandLogoCropDialog } from './BrandLogoCropDialog'

vi.mock('react-i18next', () => ({
  useTranslation: (() => {
    const t = (key) => key
    return () => ({ t })
  })(),
}))

vi.mock('@/components/layout/Modal', () => ({
  Modal: ({ children, actions }) => (
    <div role="dialog">
      {children}
      <div>{actions}</div>
    </div>
  ),
}))

function renderCrop(overrides = {}) {
  return render(
    <BrandLogoCropDialog
      open
      sourceUrl="blob:brand-logo"
      filename="source.png"
      sourceMimeType="image/png"
      sourceTransparent={false}
      onCancel={vi.fn()}
      onComplete={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  )
}

describe('BrandLogoCropDialog export', () => {
  let blobCalls
  let canvasSizes
  let toBlobSpy

  beforeEach(() => {
    blobCalls = []
    canvasSizes = []

    class ImageStub {
      naturalWidth = 1200
      naturalHeight = 900
      onload = null
      onerror = null

      set src(value) {
        this.currentSrc = value
        queueMicrotask(() => this.onload?.())
      }
    }

    vi.stubGlobal('Image', ImageStub)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext() {
      canvasSizes.push({ width: this.width, height: this.height })
      return {
        clearRect: vi.fn(),
        drawImage: vi.fn(),
      }
    })
    toBlobSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function toBlob(callback, mimeType, quality) {
        blobCalls.push({ mimeType, quality })
        callback(new Blob([new Uint8Array(1024 * 1024)], { type: mimeType }))
      })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('exports one 800×800 JPEG at the highest current quality without size retries', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue(undefined)
    renderCrop({ onComplete, sourceTransparent: false })

    const done = await screen.findByRole('button', { name: 'brands.logo.cropDone' })
    await waitFor(() => expect(done).toBeEnabled())
    await user.click(done)

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const [file] = onComplete.mock.calls[0]
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('source.jpg')
    expect(file.type).toBe('image/jpeg')
    expect(file.size).toBe(1024 * 1024)
    expect(canvasSizes).toEqual([{ width: 800, height: 800 }])
    expect(blobCalls).toEqual([{ mimeType: 'image/jpeg', quality: 0.9 }])
  })

  it('uses PNG only as the transparency-preserving encoder fallback', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue(undefined)
    let callCount = 0
    toBlobSpy.mockImplementation((callback, mimeType, quality) => {
      blobCalls.push({ mimeType, quality })
      callCount += 1
      const outputType = callCount === 1 ? 'image/png' : 'image/png'
      callback(new Blob(['fallback'], { type: outputType }))
    })
    renderCrop({ onComplete, sourceTransparent: true })

    const done = await screen.findByRole('button', { name: 'brands.logo.cropDone' })
    await waitFor(() => expect(done).toBeEnabled())
    await user.click(done)

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const [file] = onComplete.mock.calls[0]
    expect(file.type).toBe('image/png')
    expect(blobCalls).toEqual([
      { mimeType: 'image/webp', quality: 0.9 },
      { mimeType: 'image/png', quality: undefined },
    ])
  })
})
