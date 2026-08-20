import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialogProvider } from './ConfirmDialog'
import { setConfirmHandler, showConfirm } from '../lib/confirm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => ({
      'common.confirm': 'Xác nhận',
      'common.cancel': 'Huỷ',
      'common.close': 'Đóng',
    }[key] || key),
  }),
}))

afterEach(() => setConfirmHandler(null))

describe('ConfirmDialogProvider', () => {
  it('keeps neutral confirmations non-red and returns false on cancel', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialogProvider />)

    let result
    act(() => {
      result = showConfirm('Chuyển tệp vào Thùng rác. Có thể khôi phục sau.', 'Chuyển vào Thùng rác', {
        confirmLabel: 'Chuyển vào Thùng rác',
      })
    })
    const confirmButton = await screen.findByRole('button', { name: 'Chuyển vào Thùng rác' })
    expect(confirmButton.className).toContain('bg-primary')
    expect(confirmButton.className).not.toContain('bg-destructive')

    await user.click(screen.getByRole('button', { name: 'Huỷ' }))
    await expect(result).resolves.toBe(false)
  })

  it('uses the red confirmation button only for permanent deletion', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialogProvider />)

    let result
    act(() => {
      result = showConfirm('Xoá vĩnh viễn tệp "banner.jpg". Không thể hoàn tác.', 'Xoá vĩnh viễn', {
        variant: 'danger',
        confirmLabel: 'Xoá vĩnh viễn',
      })
    })
    const confirmButton = await screen.findByRole('button', { name: 'Xoá vĩnh viễn' })
    expect(confirmButton.className).toContain('bg-destructive')

    await user.click(confirmButton)
    await expect(result).resolves.toBe(true)
  })
})
