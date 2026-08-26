import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MaintenanceScreen } from './MaintenanceScreen'

const mocks = vi.hoisted(() => ({
  fetchMaintenance: vi.fn(),
  updateMaintenance: vi.fn(),
  showConfirm: vi.fn(),
  subscribeAdminWs: vi.fn(() => () => {}),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key, values = {}) => values.defaultValue ?? key }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchMaintenance: mocks.fetchMaintenance,
  updateMaintenance: mocks.updateMaintenance,
}))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('../lib/adminWebSocket', () => ({ subscribeAdminWs: mocks.subscribeAdminWs }))
vi.mock('@/lib/toast', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))

const NORMAL_DEVELOPER = {
  state: 'NORMAL',
  staffNote: '',
  updatedAt: '2026-08-06T10:00:00Z',
  canToggle: true,
  uploadCount: 0,
}

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MaintenanceScreen />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchMaintenance.mockResolvedValue(NORMAL_DEVELOPER)
  mocks.updateMaintenance.mockImplementation(async ({ state, staffNote }) => ({ ...NORMAL_DEVELOPER, state, staffNote }))
  mocks.showConfirm.mockResolvedValue(true)
  mocks.subscribeAdminWs.mockReturnValue(() => {})
})

describe('MaintenanceScreen', () => {
  it('offers one binary switch and no legacy warning or expected-time controls', async () => {
    renderScreen()

    const toggle = await screen.findByRole('switch')
    expect(toggle).toBeEnabled()
    expect(toggle).not.toBeChecked()
    expect(screen.queryByText(/Sắp bảo trì/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Báo trước cho nhân viên/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Dự kiến xong lúc/)).not.toBeInTheDocument()
  })

  it('hides the controls and explains why when the caller may not toggle', async () => {
    mocks.fetchMaintenance.mockResolvedValue({ ...NORMAL_DEVELOPER, canToggle: false })
    renderScreen()

    expect(await screen.findByText(/Chỉ tài khoản kỹ thuật \(DEVELOPER\)/)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('warns about in-flight uploads before locking, and aborts when declined', async () => {
    const user = userEvent.setup()
    mocks.fetchMaintenance.mockResolvedValue({ ...NORMAL_DEVELOPER, uploadCount: 3 })
    mocks.showConfirm.mockResolvedValue(false)
    renderScreen()

    await user.click(await screen.findByRole('switch'))

    expect(mocks.showConfirm).toHaveBeenCalledWith(
      expect.stringContaining('3'),
      expect.any(String),
      expect.objectContaining({ variant: 'danger' }),
    )
    expect(mocks.updateMaintenance).not.toHaveBeenCalled()
  })

  it('locks after confirmation, sending the staff note along', async () => {
    const user = userEvent.setup()
    renderScreen()

    const note = await screen.findByRole('textbox')
    await user.type(note, 'Nâng cấp dữ liệu')
    await user.click(screen.getByRole('switch'))

    await waitFor(() => expect(mocks.updateMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'ACTIVE', staffNote: 'Nâng cấp dữ liệu' }),
    ))
    expect(mocks.updateMaintenance.mock.calls[0][0]).not.toHaveProperty('expectedAt')
  })

  it('saves a changed staff note without changing the lock state', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.type(await screen.findByRole('textbox'), 'Ghi chú mới')
    await user.click(screen.getByRole('button', { name: /^Lưu$/ }))

    await waitFor(() => expect(mocks.updateMaintenance).toHaveBeenCalledWith({
      state: 'NORMAL',
      staffNote: 'Ghi chú mới',
    }))
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('turns the lock off without confirmation', async () => {
    const user = userEvent.setup()
    mocks.fetchMaintenance.mockResolvedValue({ ...NORMAL_DEVELOPER, state: 'ACTIVE' })
    renderScreen()

    const toggle = await screen.findByRole('switch')
    expect(toggle).toBeChecked()
    await user.click(toggle)

    expect(mocks.showConfirm).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.updateMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'NORMAL' }),
    ))
  })

  it('states plainly that customers are unaffected', async () => {
    renderScreen()

    expect(await screen.findByText(/không bị ảnh hưởng/)).toBeInTheDocument()
  })
})
