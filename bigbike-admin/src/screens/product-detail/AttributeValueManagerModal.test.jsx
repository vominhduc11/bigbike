import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AttributeValueManagerModal } from './VariantEditors'
import { hasManagedEnglishValueInput } from './attributeValueEnglishPolicy'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'vi' } }),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))

vi.mock('../../lib/confirm', () => ({ showConfirm: vi.fn() }))

vi.mock('../../lib/adminApi', async (importOriginal) => ({
  ...(await importOriginal()),
  createAttributeValue: mocks.create,
  updateAttributeValueLabel: mocks.update,
  deleteAttributeValue: mocks.remove,
}))

function mount({ attribute, values = [] }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AttributeValueManagerModal
        open
        onClose={vi.fn()}
        attribute={attribute}
        values={values}
        contentLang="vi"
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocks.create.mockReset().mockResolvedValue({ id: 'new', slug: 'new' })
  mocks.update.mockReset().mockResolvedValue({ id: 'saved' })
  mocks.remove.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
})

describe('attribute value English input policy', () => {
  it.each(['color', 'size', 'gender', 'model', 'iphone', 'chieu-dai'])(
    'does not enable English values for the immutable %s code',
    (code) => {
      expect(hasManagedEnglishValueInput({ code })).toBe(false)
    },
  )

  it.each(['bo', 'co-oc'])('keeps English values available for %s', (code) => {
    expect(hasManagedEnglishValueInput({ code })).toBe(true)
  })

  it('hides English fields for color and omits labelEn from create and rename payloads', async () => {
    const user = userEvent.setup()
    mount({
      attribute: { id: 'color', code: 'color', name: 'Màu sắc' },
      values: [{ id: 'black', label: 'Đen', labelEn: 'Black', slug: 'den', usageCount: 0 }],
    })

    expect(screen.queryByPlaceholderText('products.detail.variant.valueEnPlaceholder')).toBeNull()

    const label = screen.getByDisplayValue('Đen')
    await user.clear(label)
    await user.type(label, 'Đen mới')
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('black', { label: 'Đen mới' }))

    await user.type(
      screen.getByPlaceholderText('products.detail.variant.valueAddPlaceholder'),
      'Màu thử',
    )
    await user.click(screen.getByRole('button', { name: 'products.detail.variant.valueAddButton' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('color', { label: 'Màu thử' }))
  })

  it('allows an in-use Bo value to save an English label while keeping Vietnamese locked', async () => {
    const user = userEvent.setup()
    mount({
      attribute: { id: 'bo', code: 'bo', name: 'Bo' },
      values: [{ id: 'top', label: 'Áo', labelEn: '', slug: 'ao', usageCount: 1 }],
    })

    expect(
      screen.getAllByPlaceholderText('products.detail.variant.valueEnPlaceholder'),
    ).toHaveLength(2)
    expect(screen.getByDisplayValue('Áo')).toBeDisabled()
    const rowEnglishInput = screen.getAllByPlaceholderText(
      'products.detail.variant.valueEnPlaceholder',
    )[1]
    await user.type(rowEnglishInput, 'Top')
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith('top', { label: 'Áo', labelEn: 'Top' }),
    )
  })
})
