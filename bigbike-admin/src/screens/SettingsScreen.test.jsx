import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from './SettingsScreen'

const mocks = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  batchUpdateSettings: vi.fn(),
  showConfirm: vi.fn(),
  setContentLang: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => values.defaultValue ?? key,
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchSettings: mocks.fetchSettings,
  batchUpdateSettings: mocks.batchUpdateSettings,
}))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('../lib/contentLang', () => ({
  useContentLang: () => 'vi',
  setContentLang: mocks.setContentLang,
}))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: vi.fn() }))
vi.mock('@/lib/useSaveShortcut', () => ({ useSaveShortcut: vi.fn() }))

const settings = [
  {
    key: 'site_name',
    value: 'BigBike',
    valueEn: '',
    valueType: 'STRING',
    settingGroup: 'general',
    superAdminOnly: false,
  },
  {
    key: 'footer_description',
    value: 'Mô tả cửa hàng',
    valueEn: 'Store description',
    valueType: 'LONG_TEXT',
    settingGroup: 'general',
    superAdminOnly: false,
  },
  {
    key: 'bank_account_holder',
    value: 'BIGBIKE',
    valueEn: '',
    valueType: 'STRING',
    settingGroup: 'payment',
    superAdminOnly: false,
  },
  {
    key: 'product_assign_title',
    value: 'Phân công',
    valueEn: '',
    valueType: 'STRING',
    settingGroup: 'product_assign',
    superAdminOnly: true,
  },
]

function renderScreen(props = {}) {
  render(
    <SettingsScreen
      canUpdate
      isSuperAdmin={false}
      navigate={vi.fn()}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.fetchSettings.mockResolvedValue({ items: settings })
  mocks.batchUpdateSettings.mockImplementation(async (updates) => ({
    items: updates.map((update) => ({
      ...settings.find((item) => item.key === update.key),
      value: update.value,
      valueEn: update.valueEn,
    })),
  }))
  mocks.showConfirm.mockResolvedValue(true)
})

describe('SettingsScreen', () => {
  it('shows the bank-transfer settings tab required by the current checkout rules', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'PAYMENT' }))

    expect(screen.getByLabelText('Chủ tài khoản nhận chuyển khoản')).toHaveValue('BIGBIKE')
  })

  it('confirms and saves bank-transfer details as one atomic batch', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'PAYMENT' }))
    const holder = screen.getByLabelText('Chủ tài khoản nhận chuyển khoản')
    await user.clear(holder)
    await user.type(holder, 'BIGBIKE VN')
    await user.click(screen.getByRole('button', { name: 'settings.saveCount' }))

    expect(mocks.showConfirm).toHaveBeenCalledWith(
      'settings.confirmSaveMessage',
      'settings.confirmSaveTitle',
    )
    await waitFor(() => expect(mocks.batchUpdateSettings).toHaveBeenCalledWith([
      { key: 'bank_account_holder', value: 'BIGBIKE VN' },
    ]))
  })

  it('requires the English site name when the Vietnamese site name changes', async () => {
    const user = userEvent.setup()
    renderScreen()

    const siteName = await screen.findByLabelText(/Tên shop/)
    await user.clear(siteName)
    await user.type(siteName, 'BigBike Việt Nam')
    await user.click(screen.getByRole('button', { name: 'settings.saveCount' }))

    expect(mocks.setContentLang).toHaveBeenCalledWith('en')
    expect(mocks.batchUpdateSettings).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng nhập bản tiếng Anh')
  })

  it('shows the assignment editor only to a super admin', async () => {
    renderScreen()
    await screen.findByRole('button', { name: 'GENERAL' })
    expect(screen.queryByRole('button', { name: 'PRODUCT_ASSIGN' })).not.toBeInTheDocument()

    renderScreen({ isSuperAdmin: true })
    expect(await screen.findByRole('button', { name: 'PRODUCT_ASSIGN' })).toBeInTheDocument()
  })

  it('states clearly when the screen is view-only', async () => {
    renderScreen({ canUpdate: false })

    expect(await screen.findByText('Bạn chỉ có quyền xem cài đặt, không thể chỉnh sửa.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'settings.saveCount' })).not.toBeInTheDocument()
  })
})
