import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsScreen } from './SettingsScreen'
import { confirmNavigation } from '@/lib/navigationGuard'
import { EDITABLE_BANNER_KEYS } from './settings/bannerSettings'

const mocks = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  batchUpdateSettings: vi.fn(),
  fetchProductAssignment: vi.fn(),
}))
vi.mock('../lib/adminApi', async (importOriginal) => ({ ...(await importOriginal()), ...mocks }))
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, options = {}) =>
      ({
        'settings.group_general': 'Thông tin shop',
        'settings.group_public_hero': 'Phần đầu trang',
        'settings.group_product_assign': 'Phân công sản phẩm',
        'settings.itemCountShort': `${options.count} mục`,
      })[key] ||
      options.defaultValue ||
      key,
  }),
}))
vi.mock('../components/ImageUrlInput', () => ({ ImageUrlInput: () => null }))
vi.mock('@/lib/useSaveShortcut', () => ({ useSaveShortcut: () => {} }))
vi.mock('@/lib/contentLang', () => ({
  useContentLang: () => 'vi',
  getContentLang: () => 'vi',
  setContentLang: vi.fn(),
}))

const items = [
  {
    key: 'site_name',
    value: 'BigBike',
    valueEn: 'BigBike',
    valueType: 'STRING',
    settingGroup: 'general',
  },
  ...[...EDITABLE_BANNER_KEYS].map((key) => ({
    key,
    value: key.endsWith('_title') ? 'Original' : '',
    valueEn: '',
    valueType: key.endsWith('_url') ? 'IMAGE_URL' : 'STRING',
    settingGroup: 'public_hero',
  })),
  ...['products', 'brands', 'news'].map((page) => ({
    key: `hero_${page}_mobile_image_url`,
    value: '/media/retired.png',
    valueType: 'IMAGE_URL',
    settingGroup: 'public_hero',
  })),
  {
    key: 'product_assign_title',
    value: 'Assignments',
    valueType: 'STRING',
    settingGroup: 'product_assign',
    superAdminOnly: true,
  },
]

function renderSettings() {
  const navigate = vi.fn((path) => {
    if (confirmNavigation()) return path
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SettingsScreen canUpdate isSuperAdmin navigate={navigate} />
    </QueryClientProvider>,
  )
  return { ...view, navigate }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  window.history.replaceState({}, '', '/admin/settings')
  mocks.fetchSettings.mockResolvedValue({ items })
  mocks.fetchProductAssignment.mockResolvedValue({
    title: 'Assignments',
    roles: [{ id: 'one', name: 'Staff', items: '' }],
  })
  mocks.batchUpdateSettings.mockImplementation(async (updates) => ({
    items: updates.map((update) => ({
      ...items.find((item) => item.key === update.key),
      ...update,
    })),
  }))
})
afterEach(() => vi.restoreAllMocks())

describe('settings editors with real navigation guards', () => {
  it('retains a banner draft and its warning after visiting the clean assignment editor', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Phần đầu trang' }))
    const title = (await screen.findAllByLabelText('banners.fieldTitle'))[0]
    fireEvent.change(title, { target: { value: 'Banner draft' } })
    await user.click(screen.getByRole('button', { name: 'Phân công sản phẩm' }))
    await screen.findByDisplayValue('Assignments')
    await user.click(screen.getByRole('button', { name: 'Phần đầu trang' }))
    expect(title).toHaveValue('Banner draft')
    await user.click(screen.getByRole('button', { name: 'banners.openCategories' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(title).toHaveValue('Banner draft')
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
  })

  it('keeps shop drafts protected when banner and assignment editors mount', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    const { container } = renderSettings()
    await screen.findByDisplayValue('BigBike')
    fireEvent.change(container.querySelector('#setting-site_name'), {
      target: { value: 'Shop draft' },
    })
    await user.click(screen.getByRole('button', { name: 'Phần đầu trang' }))
    await screen.findAllByLabelText('banners.fieldTitle')
    expect(confirmNavigation()).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Phân công sản phẩm' }))
    await screen.findByDisplayValue('Assignments')
    expect(confirmNavigation()).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Thông tin shop' }))
    expect(container.querySelector('#setting-site_name')).toHaveValue('Shop draft')
  })

  it('saving the banner clears only its draft and keeps the shop warning', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    const { container } = renderSettings()
    await screen.findByDisplayValue('BigBike')
    fireEvent.change(container.querySelector('#setting-site_name'), {
      target: { value: 'Shop draft' },
    })
    await user.click(screen.getByRole('button', { name: 'Phần đầu trang' }))
    fireEvent.change((await screen.findAllByLabelText('banners.fieldTitle'))[0], {
      target: { value: 'Saved banner' },
    })
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    await screen.findByText('banners.saveSuccess')
    expect(confirmNavigation()).toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Thông tin shop' }))
    expect(container.querySelector('#setting-site_name')).toHaveValue('Shop draft')
    expect(mocks.batchUpdateSettings).toHaveBeenCalledWith([
      { key: 'hero_products_title', value: 'Saved banner' },
    ])
  })

  it('counts editable settings and excludes retired and unknown hero keys', async () => {
    mocks.fetchSettings.mockResolvedValue({
      items: [...items, { key: 'hero_unknown_fixture', value: '', settingGroup: 'public_hero' }],
    })
    renderSettings()
    const tab = await screen.findByRole('button', { name: 'Phần đầu trang' })
    await waitFor(() => expect(tab).toHaveTextContent(`${EDITABLE_BANNER_KEYS.size} mục`))
    expect(tab).not.toHaveTextContent('17 mục')
  })
})
