import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MaintenanceOverlay } from './MaintenanceOverlay'

const mocks = vi.hoisted(() => ({
  fetchMaintenance: vi.fn(),
  subscribeAdminWs: vi.fn(() => () => {}),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key, values = {}) => values.defaultValue ?? key }),
}))

vi.mock('../lib/adminApi', () => ({ fetchMaintenance: mocks.fetchMaintenance }))
vi.mock('../lib/adminWebSocket', () => ({ subscribeAdminWs: mocks.subscribeAdminWs }))

function renderOverlay() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MaintenanceOverlay />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.subscribeAdminWs.mockReturnValue(() => {})
})

describe('MaintenanceOverlay', () => {
  it('blocks staff and clearly shows the only staff message while locked', async () => {
    mocks.fetchMaintenance.mockResolvedValue({
      state: 'ACTIVE',
      staffNote: 'Đang nâng cấp dữ liệu. Dự kiến xong 15:00.',
      canToggle: false,
    })
    renderOverlay()

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Đang nâng cấp dữ liệu. Dự kiến xong 15:00.')).toBeInTheDocument()
    expect(screen.getByText('Lời nhắn cho nhân viên')).toBeInTheDocument()
    expect(screen.queryByText(/Dự kiến xong lúc/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Sắp bảo trì/)).not.toBeInTheDocument()
  })

  it('shows a non-blocking lock banner to the developer', async () => {
    mocks.fetchMaintenance.mockResolvedValue({
      state: 'ACTIVE',
      staffNote: 'Đang chạy cập nhật.',
      canToggle: true,
    })
    renderOverlay()

    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText('Đang chạy cập nhật.')).toBeInTheDocument()
  })

  it('renders nothing in normal state', async () => {
    mocks.fetchMaintenance.mockResolvedValue({ state: 'NORMAL', staffNote: '', canToggle: false })
    renderOverlay()

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
