import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImportProductsDialog } from './ImportProductsDialog'
import { importProductsValidate } from '@/lib/adminApi'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, options = {}) => options.defaultValue || key }),
}))

vi.mock('@/lib/adminApi', () => ({
  ApiClientError: class ApiClientError extends Error {},
  importProductsCommit: vi.fn(),
  importProductsValidate: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn() } }))

const validationReport = {
  okCount: 1,
  warningCount: 0,
  errorCount: 0,
  skippedCount: 0,
  rows: [
    {
      rowKey: '1',
      rowNumber: 1,
      productName: 'Áo bảo hộ',
      action: 'CREATE',
      status: 'OK',
      errors: [],
      warnings: [],
    },
  ],
}

function renderDialog(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ImportProductsDialog
        file={new File(['{}'], 'products.json', { type: 'application/json' })}
        open
        onClose={onClose}
      />
    </QueryClientProvider>,
  )
}

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

describe('ImportProductsDialog accessibility', () => {
  it('có tên truy cập được, đóng bằng Esc và giữ tiêu điểm trong hộp thoại', async () => {
    importProductsValidate.mockResolvedValue(validationReport)
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderDialog(onClose)

    const dialog = await screen.findByRole('dialog', { name: 'import.dialogTitle' })
    await expectFocusTrap(user, dialog)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
