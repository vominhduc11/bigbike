import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CustomerStatusReasonModal } from './CustomerStatusReasonModal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, options = {}) => options.defaultValue || key }),
}))

async function expectFocusTrap(user, dialog) {
  const buttons = within(dialog).getAllByRole('button')
  const first = buttons[0]
  const last = buttons.at(-1)

  last.focus()
  await user.tab()
  expect(document.activeElement).toBe(first)

  first.focus()
  await user.tab({ shift: true })
  expect(document.activeElement).toBe(last)
}

describe('CustomerStatusReasonModal accessibility', () => {
  it('có tên truy cập được, đóng bằng Esc và giữ tiêu điểm trong hộp thoại', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <CustomerStatusReasonModal
        title="Đổi trạng thái khách hàng"
        description="Nhập lý do để lưu vào nhật ký nội bộ."
        confirmLabel="Xác nhận"
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Đổi trạng thái khách hàng' })
    await expectFocusTrap(user, dialog)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
