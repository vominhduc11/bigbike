import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MediaPreviewLightbox } from './MediaPreviewLightbox'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, options = {}) => options.defaultValue || key }),
}))

const items = [
  { publicUrl: '/media/reviews/one.jpg', mimeType: 'image/jpeg', filename: 'one.jpg', altText: 'Ảnh review một' },
  { publicUrl: '/media/reviews/two.jpg', mimeType: 'image/jpeg', filename: 'two.jpg', altText: 'Ảnh review hai' },
]

describe('MediaPreviewLightbox', () => {
  it('handles loading, image failure, arrows and Escape', () => {
    const onClose = vi.fn()
    const onNavigate = vi.fn()
    render(<MediaPreviewLightbox items={items} index={0} onClose={onClose} onNavigate={onNavigate} />)

    const dialog = screen.getByRole('dialog')
    const image = screen.getByAltText('Ảnh review một')
    expect(screen.getByText('Đang tải ảnh…')).toBeInTheDocument()

    fireEvent.load(image)
    expect(screen.queryByText('Đang tải ảnh…')).not.toBeInTheDocument()
    fireEvent.error(image)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(onNavigate).toHaveBeenCalledWith(1)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps focus inside the dialog when tabbing from the last action', () => {
    const onClose = vi.fn()
    const onNavigate = vi.fn()
    render(<MediaPreviewLightbox items={items} index={0} onClose={onClose} onNavigate={onNavigate} />)

    const dialog = screen.getByRole('dialog')
    const close = screen.getByRole('button', { name: 'common.close' })
    const next = screen.getByRole('button', { name: 'media.next' })
    Object.defineProperty(close, 'offsetParent', { configurable: true, value: document.body })
    Object.defineProperty(next, 'offsetParent', { configurable: true, value: document.body })
    next.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
  })
})
