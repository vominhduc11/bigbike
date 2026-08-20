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

    const dialog = screen.getByRole('dialog', { name: 'one.jpg' })
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

  // Regression: class `z-modal` KHÔNG phải utility Tailwind v4 (namespace --z-* không
  // sinh utility z-index) nên overlay từng có z-index: auto → checkbox (z:2), overlay
  // nút thao tác (z:10) và topbar (z:100) của lưới ảnh nổi đè lên lightbox.
  it('stacks above the grid with the modal z-index token', () => {
    render(<MediaPreviewLightbox items={items} index={0} onClose={vi.fn()} onNavigate={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('z-[var(--admin-z-modal)]')
    expect(dialog.className).not.toMatch(/(^|\s)z-modal(\s|$)/)
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

  it('hiện nút tải cho object lưu trong MinIO và gọi callback với item hiện tại', async () => {
    const onDownload = vi.fn()
    const storedItems = items.map((item) => ({ ...item, storageProvider: 'MINIO', filePath: `uploads/${item.filename}` }))
    render(<MediaPreviewLightbox items={storedItems} index={0} onClose={vi.fn()} onNavigate={vi.fn()} onDownload={onDownload} />)

    const button = screen.getByRole('button', { name: 'media.download' })
    expect(button).toHaveAttribute('title', 'media.download')
    await fireEvent.click(button)
    expect(onDownload).toHaveBeenCalledWith(storedItems[0])
  })
})
