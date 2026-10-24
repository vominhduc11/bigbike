import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LivePreview } from './LivePreview'

const webOrigin = 'https://bigbike.vn'
const props = {
  open: true,
  onClose: vi.fn(),
  data: { id: 'prod_preview', name: 'Nội dung đang sửa' },
  lang: 'vi',
  onLangChange: vi.fn(),
  device: 'desktop',
  onDeviceChange: vi.fn(),
  webOrigin,
  previewPath: '/preview/product/',
  i18nPrefix: 'products.detail.preview',
  t: (_key, options = {}) => options.defaultValue,
}

function ready(frame, origin = webOrigin, source = frame.contentWindow) {
  fireEvent(
    window,
    new MessageEvent('message', {
      origin,
      source,
      data: { type: 'bigbike-preview-ready' },
    }),
  )
}

describe('LivePreview loading and handshake', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('waits for its own iframe and origin before sending the latest unsaved content', () => {
    const { container, rerender } = render(<LivePreview {...props} />)
    const frame = container.querySelector('iframe')
    const postMessage = vi.spyOn(frame.contentWindow, 'postMessage')
    const latestData = { ...props.data, name: 'Nội dung mới nhất' }
    rerender(<LivePreview {...props} data={latestData} />)

    ready(frame, 'https://untrusted.example')
    ready(frame, webOrigin, window)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải trang xem trước')
    expect(postMessage).not.toHaveBeenCalled()

    ready(frame)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'bigbike-preview', data: latestData, lang: 'vi' },
      webOrigin,
    )
    act(() => vi.advanceTimersByTime(15_000))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    rerender(<LivePreview {...props} data={latestData} lang="en" />)
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'bigbike-preview', data: latestData, lang: 'en' },
      webOrigin,
    )
  })

  it('reports a stalled page and retries only the iframe with the latest content', () => {
    const { container, rerender } = render(<LivePreview {...props} />)
    const oldFrame = container.querySelector('iframe')
    act(() => vi.advanceTimersByTime(15_000))
    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được trang xem trước')

    const latestData = { ...props.data, name: 'Chỉnh sửa chưa lưu' }
    rerender(<LivePreview {...props} data={latestData} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    const frame = container.querySelector('iframe')
    expect(frame).not.toBe(oldFrame)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const postMessage = vi.spyOn(frame.contentWindow, 'postMessage')
    ready(frame)
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'bigbike-preview', data: latestData, lang: 'vi' },
      webOrigin,
    )
  })

  it('starts a fresh handshake when reopened and removes its timer while closed', () => {
    const { container, rerender } = render(<LivePreview {...props} />)
    ready(container.querySelector('iframe'))
    rerender(<LivePreview {...props} open={false} />)
    expect(container.querySelector('iframe')).toBeNull()
    act(() => vi.advanceTimersByTime(15_000))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const latestData = { ...props.data, name: 'Nội dung lúc mở lại' }
    rerender(<LivePreview {...props} data={latestData} />)
    const frame = container.querySelector('iframe')
    const postMessage = vi.spyOn(frame.contentWindow, 'postMessage')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(postMessage).not.toHaveBeenCalled()
    ready(frame)
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'bigbike-preview', data: latestData, lang: 'vi' },
      webOrigin,
    )
  })
})
