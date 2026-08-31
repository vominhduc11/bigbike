import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchAdminQuickSearch: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => {
      const labels = {
        'search.open': 'Open quick search',
        'search.placeholder': 'Search orders, products, customers and content...',
        'search.title': 'Quick search',
        'search.hint': 'Type a keyword to find orders, products or content.',
        'search.loading': 'Searching...',
        'search.empty': 'No results found.',
        'search.groupEmpty': 'No results in this group.',
        'search.viewAll': 'View all {{count}} results',
        'search.keyboardHint': 'Use arrows to choose, Enter to open, Esc to close',
        'search.group.orders': 'Orders',
        'search.group.products': 'Products',
        'search.group.customers': 'Customers',
        'search.group.categories': 'Categories',
        'search.group.brands': 'Brands',
        'search.group.articles': 'Articles',
        'search.group.adminUsers': 'Admin accounts',
        'search.skuTbd': 'No SKU yet',
        'search.errorTitle': 'Search failed',
        'search.errorBody': 'Something went wrong while searching.',
        'search.groupErrorTitle': 'This group is unavailable',
        'search.groupErrorBody': 'Other groups are still available.',
      }
      return String(labels[key] || key).replace(/\{\{(\w+)\}\}/g, (_, name) =>
        String(values[name] ?? name),
      )
    },
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchAdminQuickSearch: mocks.fetchAdminQuickSearch,
}))

vi.mock('../lib/useDebounce', () => ({
  useDebounce: (value) => value,
}))

vi.mock('../lib/useDialogA11y', () => ({
  useDialogA11y: () => {},
}))

const { GlobalSearch } = await import('./GlobalSearch')

const ALL_SEARCH_PATHS = new Set([
  '/admin/orders',
  '/admin/products',
  '/admin/customers',
  '/admin/categories',
  '/admin/brands',
  '/admin/content',
  '/admin/admin-users',
])

function ready(items, total = items.length) {
  return { state: 'READY', total, items, errorCode: null }
}

function order(id, orderNumber, customerName) {
  return {
    id,
    orderNumber,
    customerName,
    shippingRecipientName: customerName,
    customerEmail: `${id}@example.test`,
    totalAmount: 1250000,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/admin/dashboard')
  mocks.fetchAdminQuickSearch.mockResolvedValue({ groups: {} })
})

describe('GlobalSearch', () => {
  it('shows accent-insensitive results, variant SKU context and the full-list link', async () => {
    const user = userEvent.setup()
    mocks.fetchAdminQuickSearch.mockResolvedValue({
      groups: {
        orders: ready([order('order-1', 'BB-1001', 'Nguyễn Văn A')], 6),
        products: ready([
          {
            id: 'product-1',
            name: 'Mũ bảo hiểm',
            sku: 'PRODUCT-ROOT',
            matchedVariants: [{ id: 'variant-1', sku: 'LABEL-RED-M', name: 'Đỏ / M', options: [] }],
          },
        ]),
        customers: ready([]),
      },
    })

    render(
      <GlobalSearch
        navigate={mocks.navigate}
        visiblePaths={new Set(['/admin/orders', '/admin/products', '/admin/customers'])}
      />,
    )

    await user.click(screen.getAllByRole('button', { name: 'Open quick search' })[0])
    await user.type(screen.getByRole('combobox'), 'nguyen')

    await waitFor(() => expect(mocks.fetchAdminQuickSearch).toHaveBeenCalledWith('nguyen'))
    expect(screen.getByRole('option', { name: /Nguyễn Văn A/ })).toBeInTheDocument()
    expect(screen.getByText('LABEL-RED-M · Đỏ / M')).toBeInTheDocument()
    expect(screen.getByText('View all 6 results')).toBeInTheDocument()
    expect(screen.getAllByText('Orders').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('mark').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('option', { name: /Nguyễn Văn A/ }))
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/orders/order-1')
  })

  it('keeps a group-local error visible while another group remains usable', async () => {
    const user = userEvent.setup()
    mocks.fetchAdminQuickSearch.mockResolvedValue({
      groups: {
        orders: { state: 'ERROR', total: null, items: [], errorCode: 'SEARCH_GROUP_UNAVAILABLE' },
        products: ready([{ id: 'product-1', name: 'Mũ đỏ', sku: 'RED-1', matchedVariants: [] }]),
      },
    })

    render(
      <GlobalSearch
        navigate={mocks.navigate}
        visiblePaths={new Set(['/admin/orders', '/admin/products'])}
      />,
    )
    await user.click(screen.getAllByRole('button', { name: 'Open quick search' })[0])
    await user.type(screen.getByRole('combobox'), 'do')

    await waitFor(() => expect(screen.getByText('This group is unavailable')).toBeInTheDocument())
    expect(screen.getByRole('option', { name: /Mũ đỏ/ })).toBeInTheDocument()
    expect(screen.queryByText('Search failed')).not.toBeInTheDocument()
  })

  it('passes special characters to the full-list URL without turning them into wildcards', async () => {
    const user = userEvent.setup()
    mocks.fetchAdminQuickSearch.mockResolvedValue({
      groups: { orders: ready([order('order-1', 'BB-%', 'Khách')], 1) },
    })

    render(<GlobalSearch navigate={mocks.navigate} visiblePaths={new Set(['/admin/orders'])} />)
    await user.click(screen.getAllByRole('button', { name: 'Open quick search' })[0])
    await user.type(screen.getByRole('combobox'), '%')

    const viewAll = await screen.findByText('View all 1 results')
    await user.click(viewAll)
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/orders?search=%25')
  })

  it('does not render the search control when no searchable module is permitted', () => {
    render(<GlobalSearch navigate={mocks.navigate} visiblePaths={new Set(['/admin/dashboard'])} />)
    expect(screen.queryByRole('button', { name: 'Open quick search' })).not.toBeInTheDocument()
  })

  it('includes the keyboard hint and supports Ctrl+K', async () => {
    render(<GlobalSearch navigate={mocks.navigate} visiblePaths={ALL_SEARCH_PATHS} />)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))

    expect(await screen.findByRole('dialog', { name: 'Quick search' })).toBeInTheDocument()
    expect(
      screen.getByText('Use arrows to choose, Enter to open, Esc to close'),
    ).toBeInTheDocument()
  })
})
