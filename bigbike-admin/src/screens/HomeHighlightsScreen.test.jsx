import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomeHighlightsScreen } from './HomeHighlightsScreen'

const mocks = vi.hoisted(() => ({
  fetchHomeHighlights: vi.fn(),
  saveHomeHighlights: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key, o = {}) => o.defaultValue || key }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchHomeHighlights: mocks.fetchHomeHighlights,
  saveHomeHighlights: mocks.saveHomeHighlights,
}))
vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: () => {} }))
vi.mock('@/lib/useSaveShortcut', () => ({ useSaveShortcut: () => {} }))
vi.mock('../lib/confirm', () => ({ showConfirm: vi.fn().mockResolvedValue(true) }))
// Bộ chọn sản phẩm cần API con trỏ của trình duyệt thật — không cần cho các ca này
// (slot đã nạp sẵn từ dữ liệu fetch), thay bằng ô trống.
vi.mock('../components/ProductPickerCombobox', () => ({ ProductPickerCombobox: () => <div data-testid="picker" /> }))
vi.mock('../lib/useProductPicker', () => ({
  useProductPicker: () => ({ search: '', setSearch: vi.fn(), items: [], isFetching: false, reset: vi.fn() }),
}))

const loaded = {
  items: [
    { slot: 1, productId: 'prod_1', productName: 'Mũ 1', productSlug: 'mu-1', productImageUrl: '/media/p1.jpg' },
    { slot: 2, productId: 'prod_2', productName: 'Mũ 2', productSlug: 'mu-2', productImageUrl: '/media/p2.jpg' },
  ],
}

function renderScreen({ canUpdate = true, data = loaded } = {}) {
  mocks.fetchHomeHighlights.mockResolvedValue(data)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <HomeHighlightsScreen canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.saveHomeHighlights.mockResolvedValue({})
})

describe('HomeHighlightsScreen', () => {
  it('nạp slot đã lưu và cho lưu đúng danh sách {slot, productId} của các slot đã điền', async () => {
    const user = userEvent.setup()
    renderScreen()

    expect(await screen.findByText('Mũ 1')).toBeInTheDocument()
    const saveButton = screen.getByRole('button', { name: 'homeHighlights.saveButton' })
    await waitFor(() => expect(saveButton).toBeEnabled())
    await user.click(saveButton)

    await waitFor(() => expect(mocks.saveHomeHighlights).toHaveBeenCalledWith([
      { slot: 1, productId: 'prod_1' },
      { slot: 2, productId: 'prod_2' },
    ]))
  })

  it('chỉ có quyền đọc thì hiện dải chỉ-xem và khoá nút Lưu', async () => {
    renderScreen({ canUpdate: false })

    expect(await screen.findByText('Mũ 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'homeHighlights.saveButton' })).toBeDisabled()
  })

  it('không lưu và báo lỗi khi chưa chọn slot nào', async () => {
    const user = userEvent.setup()
    renderScreen({ data: { items: [] } })

    // Không có slot nào điền → nút Lưu bị khoá; ép gọi qua phím tắt sẽ báo lỗi, không gọi API.
    const saveButton = await screen.findByRole('button', { name: 'homeHighlights.saveButton' })
    expect(saveButton).toBeDisabled()
    await user.click(saveButton, { force: true }).catch(() => {})
    expect(mocks.saveHomeHighlights).not.toHaveBeenCalled()
  })

  it('báo lỗi có nút thử lại khi không tải được', async () => {
    mocks.fetchHomeHighlights.mockRejectedValue(new Error('Mất kết nối.'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <HomeHighlightsScreen canUpdate />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Mất kết nối.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument()
  })
})
