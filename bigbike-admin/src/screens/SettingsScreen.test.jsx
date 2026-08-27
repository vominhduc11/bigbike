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
    key: 'seo_home_h1',
    value: 'Dữ liệu H1 cũ',
    valueEn: 'Legacy H1 data',
    valueType: 'STRING',
    settingGroup: 'seo',
    superAdminOnly: false,
  },
  {
    key: 'seo_home_title',
    value: 'Tiêu đề SEO',
    valueEn: 'SEO title',
    valueType: 'STRING',
    settingGroup: 'seo',
    superAdminOnly: false,
  },
  {
    key: 'seo_home_description',
    value: 'Mô tả SEO',
    valueEn: 'SEO description',
    valueType: 'LONG_TEXT',
    settingGroup: 'seo',
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
  it('shows a designed loading state before settings are available', () => {
    mocks.fetchSettings.mockReturnValue(new Promise(() => {}))
    renderScreen()

    expect(screen.getByRole('button', { name: 'settings.refresh' })).toBeDisabled()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows the initial error state and allows retrying', async () => {
    mocks.fetchSettings.mockRejectedValueOnce(new Error('Mất kết nối'))
    renderScreen()

    expect(await screen.findByText('settings.loadError')).toBeInTheDocument()
    expect(screen.getByText('Mất kết nối')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'common.retry' }))
    expect(mocks.fetchSettings).toHaveBeenCalledTimes(2)
  })

  it('shows a clear empty state when no settings are available', async () => {
    mocks.fetchSettings.mockResolvedValue({ items: [] })
    renderScreen()

    expect(await screen.findByText('settings.noSettings')).toBeInTheDocument()
    expect(screen.getByText('settings.noSettingsDesc')).toBeInTheDocument()
  })

  it('keeps the current tab and local draft while refreshing', async () => {
    const user = userEvent.setup()
    let resolveRefresh
    mocks.fetchSettings
      .mockResolvedValueOnce({ items: settings })
      .mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve }))
    renderScreen()

    const siteName = await screen.findByLabelText(/Tên shop/)
    await user.clear(siteName)
    await user.type(siteName, 'BigBike mới')
    await user.click(screen.getByRole('button', { name: 'settings.refresh' }))

    expect(screen.getByRole('button', { name: 'settings.refreshing' })).toBeDisabled()
    expect(siteName).toHaveValue('BigBike mới')

    resolveRefresh({ items: settings })
    await waitFor(() => expect(screen.getByRole('button', { name: 'settings.refresh' })).toBeEnabled())
    expect(siteName).toHaveValue('BigBike mới')
  })

  it('keeps existing data and draft visible when refresh fails', async () => {
    const user = userEvent.setup()
    mocks.fetchSettings
      .mockResolvedValueOnce({ items: settings })
      .mockRejectedValueOnce(new Error('Không thể cập nhật'))
    renderScreen()

    const siteName = await screen.findByLabelText(/Tên shop/)
    await user.clear(siteName)
    await user.type(siteName, 'BigBike nháp')
    await user.click(screen.getByRole('button', { name: 'settings.refresh' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể cập nhật')
    expect(siteName).toHaveValue('BigBike nháp')
  })

  it('shows the bank-transfer settings tab required by the current checkout rules', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'PAYMENT' }))

    expect(screen.getByLabelText('Chủ tài khoản nhận chuyển khoản')).toHaveValue('BIGBIKE')
  })

  it('hides the legacy homepage H1 setting while keeping other SEO settings visible', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'SEO' }))

    expect(screen.getByLabelText('Tiêu đề SEO trang chủ')).toBeInTheDocument()
    expect(screen.getByLabelText('Mô tả SEO trang chủ')).toBeInTheDocument()
    expect(screen.queryByLabelText('Tiêu đề chính trang chủ')).not.toBeInTheDocument()
    expect(screen.queryByText('Dữ liệu H1 cũ')).not.toBeInTheDocument()
  })

  // V374: chế độ bảo trì đã rời khỏi màn Cài đặt hẳn — nay là màn riêng gate theo vai
  // trò DEVELOPER. Giữ trong site_settings sẽ khiến bất kỳ ai có `settings.write` cũng
  // mở khoá được, vì AdminSettingsService coi key không có định nghĩa là KHÔNG hạn chế.
  it('no longer exposes a maintenance tab in settings', async () => {
    renderScreen()

    await screen.findByRole('button', { name: 'GENERAL' })
    expect(screen.queryByRole('button', { name: 'MAINTENANCE' })).not.toBeInTheDocument()
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

  it('does not count a field as unsaved after reverting to its original value', async () => {
    const user = userEvent.setup()
    renderScreen()

    const siteName = await screen.findByLabelText(/Tên shop/)
    await user.clear(siteName)
    await user.type(siteName, 'BigBike tạm')
    expect(screen.getByRole('button', { name: 'settings.saveCount' })).toBeInTheDocument()

    await user.clear(siteName)
    await user.type(siteName, 'BigBike')
    expect(screen.queryByRole('button', { name: 'settings.saveCount' })).not.toBeInTheDocument()
  })

  it('supports keyboard navigation in the mobile tab strip', async () => {
    const user = userEvent.setup()
    renderScreen()

    const tabs = await screen.findAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    tabs[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveFocus()
  })
})
