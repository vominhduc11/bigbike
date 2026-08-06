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
  expectedAt: null,
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
  mocks.updateMaintenance.mockImplementation(async ({ state }) => ({ ...NORMAL_DEVELOPER, state }))
  mocks.showConfirm.mockResolvedValue(true)
  mocks.subscribeAdminWs.mockReturnValue(() => {})
})

describe('MaintenanceScreen', () => {
  it('offers all three transitions to a developer', async () => {
    renderScreen()

    expect(await screen.findByRole('button', { name: /Báo trước cho nhân viên/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Khoá ngay/ })).toBeEnabled()
    // Already NORMAL, so "unlock" has nothing to do.
    expect(screen.getByRole('button', { name: /Mở lại/ })).toBeDisabled()
  })

  it('hides the controls and explains why when the caller may not toggle', async () => {
    mocks.fetchMaintenance.mockResolvedValue({ ...NORMAL_DEVELOPER, canToggle: false })
    renderScreen()

    expect(await screen.findByText(/Chỉ tài khoản kỹ thuật \(DEVELOPER\)/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Khoá ngay/ })).not.toBeInTheDocument()
  })

  it('warns about in-flight uploads before locking, and aborts when declined', async () => {
    const user = userEvent.setup()
    mocks.fetchMaintenance.mockResolvedValue({ ...NORMAL_DEVELOPER, uploadCount: 3 })
    mocks.showConfirm.mockResolvedValue(false)
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Khoá ngay/ }))

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
    await user.click(screen.getByRole('button', { name: /Khoá ngay/ }))

    await waitFor(() => expect(mocks.updateMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'ACTIVE', staffNote: 'Nâng cấp dữ liệu' }),
    ))
  })

  /** UPCOMING must not need a confirmation — it changes nothing for staff except a warning. */
  it('sets the advance warning without a confirm dialog', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Báo trước cho nhân viên/ }))

    expect(mocks.showConfirm).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.updateMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'UPCOMING' }),
    ))
  })

  it('states plainly that customers are unaffected', async () => {
    renderScreen()

    expect(await screen.findByText(/không bị ảnh hưởng/)).toBeInTheDocument()
  })
})
