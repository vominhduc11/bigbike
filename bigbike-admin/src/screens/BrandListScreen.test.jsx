import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrandListScreen } from './BrandListScreen'

const mocks = vi.hoisted(() => ({
  fetchBrands: vi.fn(),
  deleteBrand: vi.fn(),
  restoreBrand: vi.fn(),
  permanentDeleteBrand: vi.fn(),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchBrands: mocks.fetchBrands,
  deleteBrand: mocks.deleteBrand,
  restoreBrand: mocks.restoreBrand,
  permanentDeleteBrand: mocks.permanentDeleteBrand,
}))
vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('../lib/useDebounce', () => ({ useDebounce: (value) => value }))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ rows, columns }) => (
    <div data-testid="brand-table">
      {rows.map((row) => (
        <div key={row.id} data-testid={`brand-row-${row.id}`}>
          {columns.map((column) => <div key={column.key}>{column.render ? column.render(row) : row[column.key]}</div>)}
        </div>
      ))}
    </div>
  ),
}))

const visibleBrand = {
  id: 'brand_ls2',
  slug: 'ls2',
  name: 'LS2',
  isVisible: true,
  showOnHomepage: false,
  updatedAt: '2026-07-22T00:00:00Z',
  logoQuality: { status: 'LEGACY', issues: ['NOT_SQUARE'], ratio: 1.5 },
}
const systemBrand = {
  id: 'uncategorized-brand',
  slug: 'uncategorized-brand',
  name: 'Chưa phân loại',
  isVisible: false,
  showOnHomepage: true,
}

function renderScreen(canUpdate = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const navigate = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <BrandListScreen navigate={navigate} canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
  return { navigate }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/admin/brands')
  mocks.fetchBrands.mockResolvedValue({
    items: [visibleBrand, systemBrand],
    pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  })
  mocks.showConfirm.mockResolvedValue(false)
  mocks.deleteBrand.mockResolvedValue({ item: { ...visibleBrand, isVisible: false } })
  mocks.restoreBrand.mockResolvedValue({ item: visibleBrand })
  mocks.permanentDeleteBrand.mockResolvedValue({ reassignedProductCount: 2 })
})

describe('BrandListScreen', () => {
  it('requests visible brands by default and never renders the system brand', async () => {
    renderScreen()

    expect(await screen.findByText('LS2')).toBeInTheDocument()
    expect(screen.queryByText('Chưa phân loại')).not.toBeInTheDocument()
    expect(mocks.fetchBrands).toHaveBeenLastCalledWith(expect.objectContaining({ visibility: 'VISIBLE' }))
  })

  it('shows one quality summary and keeps each affected row compact', async () => {
    renderScreen()

    expect(await screen.findByText('brands.logo.quality.summary')).toBeInTheDocument()
    expect(screen.getByText('brands.logo.quality.rowWarning')).toBeInTheDocument()
    expect(screen.queryByText('brands.logo.quality.legacy')).not.toBeInTheDocument()
  })

  it('uses the read-only banner and hides write actions', async () => {
    renderScreen(false)

    expect(await screen.findByText('brands.readOnly')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'brands.create' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'brands.hideAction' })).not.toBeInTheDocument()
  })

  it('does not hide a brand when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    renderScreen()

    const row = await screen.findByTestId('brand-row-brand_ls2')
    await user.click(within(row).getByRole('button', { name: 'common.actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'brands.hideAction' }))
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1)
    expect(mocks.deleteBrand).not.toHaveBeenCalled()
  })

  it('soft-deletes only after confirmation and keeps the current list query', async () => {
    const user = userEvent.setup()
    mocks.showConfirm.mockResolvedValue(true)
    renderScreen()

    const row = await screen.findByTestId('brand-row-brand_ls2')
    await user.click(within(row).getByRole('button', { name: 'common.actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'brands.hideAction' }))
    await waitFor(() => expect(mocks.deleteBrand).toHaveBeenCalledWith('brand_ls2'))
    expect(mocks.fetchBrands).toHaveBeenLastCalledWith(expect.objectContaining({ visibility: 'VISIBLE' }))
  })

  it('hiện dải "Vừa xem gần đây" từ thương hiệu đã mở ở màn chi tiết', async () => {
    localStorage.setItem('recent:brands', JSON.stringify([{ id: 'brand_ls2', label: 'LS2' }]))
    const { navigate } = renderScreen()
    const user = userEvent.setup()

    const chip = await screen.findByRole('button', { name: 'LS2' })
    const recentItems = screen.getByRole('group', { name: 'common.recentItems' })
    const filterBar = screen.getByRole('region', { name: 'brands.filterAria' })
    expect(recentItems.compareDocumentPosition(filterBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(chip)
    expect(navigate).toHaveBeenCalledWith('/admin/brands/brand_ls2')
    localStorage.removeItem('recent:brands')
  })
})
