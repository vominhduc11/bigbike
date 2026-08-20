import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProductPicker } from './useProductPicker'

const mocks = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  hasPermission: vi.fn(),
}))

vi.mock('./adminApi', () => ({
  fetchProducts: mocks.fetchProducts,
}))

vi.mock('./auth', () => ({
  useHasPermission: () => mocks.hasPermission,
}))

vi.mock('./useDebounce', () => ({
  useDebounce: (value) => value,
}))

function Harness() {
  const picker = useProductPicker({
    queryKey: 'permission-test',
    enabled: true,
    minQueryLength: 0,
  })
  return <span>{picker.permissionDenied ? 'denied' : `items:${picker.items.length}`}</span>
}

function renderHarness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchProducts.mockResolvedValue({ items: [{ id: 'p1' }] })
})

describe('useProductPicker permission gate', () => {
  it('does not call products API without products.read', () => {
    mocks.hasPermission.mockReturnValue(false)
    renderHarness()

    expect(screen.getByText('denied')).toBeInTheDocument()
    expect(mocks.fetchProducts).not.toHaveBeenCalled()
  })

  it('loads products when the caller and permission both enable it', async () => {
    mocks.hasPermission.mockImplementation((permission) => permission === 'products.read')
    renderHarness()

    await waitFor(() => expect(screen.getByText('items:1')).toBeInTheDocument())
    expect(mocks.fetchProducts).toHaveBeenCalledTimes(1)
  })
})
