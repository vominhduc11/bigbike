import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => ({
      'products.detail.aiBrief.previewLoading': 'Đang đọc số liệu để cập nhật bản xem trước...',
      'products.detail.aiBrief.previewFailed': 'Chưa lấy được số liệu mới; đang hiển thị hướng dẫn chung. Bấm Sao chép để thử lại.',
      'products.detail.aiBrief.copied': 'Đã sao chép',
      'products.detail.aiBrief.copyFailed': 'Không sao chép được',
    }[key] || key),
  }),
}))

vi.mock('@/lib/toast', () => ({ toast }))

import AiHtmlBrief from './AiHtmlBrief'

function renderBrief(getPrompt) {
  return render(
    <AiHtmlBrief
      prompt="HƯỚNG DẪN NỀN"
      getPrompt={getPrompt}
      title="Hướng dẫn tạo HTML"
      copyLabel="Sao chép"
      copiedMessage="Đã sao chép"
      copyFailedMessage="Không sao chép được"
    />,
  )
}

describe('AiHtmlBrief preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    })
  })

  it('loads the dynamic profile when opened and does not reload on repeated toggles', async () => {
    const getPrompt = vi.fn().mockResolvedValue('HỒ SƠ SẢN PHẨM: Mũ AGV')
    const user = userEvent.setup()
    renderBrief(getPrompt)

    await user.click(screen.getByRole('button', { name: 'Hướng dẫn tạo HTML' }))
    expect(await screen.findByText('HỒ SƠ SẢN PHẨM: Mũ AGV')).toBeInTheDocument()
    expect(getPrompt).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Hướng dẫn tạo HTML' }))
    await user.click(screen.getByRole('button', { name: 'Hướng dẫn tạo HTML' }))
    expect(getPrompt).toHaveBeenCalledTimes(1)
  })

  it('shows the base brief while loading and refreshes the preview when copied', async () => {
    let resolveFirst
    const getPrompt = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce('HỒ SƠ MỚI NHẤT: SKU-123')
    const user = userEvent.setup()
    renderBrief(getPrompt)

    await user.click(screen.getByRole('button', { name: 'Hướng dẫn tạo HTML' }))
    expect(screen.getByRole('status')).toHaveTextContent('Đang đọc số liệu')
    expect(screen.getByText('HƯỚNG DẪN NỀN')).toBeInTheDocument()

    resolveFirst('HỒ SƠ XEM TRƯỚC: SKU-123')
    expect(await screen.findByText('HỒ SƠ XEM TRƯỚC: SKU-123')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sao chép' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(getPrompt).toHaveBeenCalledTimes(2)
    expect(screen.getByText('HỒ SƠ MỚI NHẤT: SKU-123')).toBeInTheDocument()
  })

  it('keeps the base brief and shows a gentle warning when profile loading fails', async () => {
    const getPrompt = vi.fn().mockRejectedValue(new Error('profile unavailable'))
    const user = userEvent.setup()
    renderBrief(getPrompt)

    await user.click(screen.getByRole('button', { name: 'Hướng dẫn tạo HTML' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa lấy được số liệu mới')
    expect(screen.getByText('HƯỚNG DẪN NỀN')).toBeInTheDocument()
    expect(getPrompt).toHaveBeenCalledTimes(1)
  })
})
