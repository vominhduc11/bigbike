import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BannerScreen } from './BannerScreen'

const mocks = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  batchUpdateSettings: vi.fn(),
  showConfirm: vi.fn(),
  contentLang: 'vi',
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
  mapValidationErrors: () => ({}),
}))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: vi.fn() }))
vi.mock('@/lib/contentLang', () => ({ useContentLang: () => mocks.contentLang }))
vi.mock('@/lib/contracts', () => ({ resolveDisplayUrl: (value) => value }))
vi.mock('../components/ImageUrlInput', () => ({
  ImageUrlInput: ({ value, disabled }) => (
    <input aria-label={`image-${value || 'empty'}`} value={value || ''} disabled={disabled} readOnly />
  ),
}))

const pageSettings = [
  ['hero_products_title', 'Tất cả sản phẩm', 'All products', 'STRING'],
  ['hero_products_image_alt', 'Banner tất cả sản phẩm', 'All products banner', 'STRING'],
  ['hero_products_image_url', '', '', 'IMAGE_URL'],
  ['hero_products_illustration_url', '', '', 'IMAGE_URL'],
  ['hero_brands_title', 'Thương hiệu', 'Brands', 'STRING'],
  ['hero_brands_image_alt', 'Banner thương hiệu', 'Brands banner', 'STRING'],
  ['hero_brands_image_url', '', '', 'IMAGE_URL'],
  ['hero_brands_illustration_url', '', '', 'IMAGE_URL'],
  ['hero_news_title', 'Tin tức', 'News', 'STRING'],
  ['hero_news_image_alt', 'Banner tin tức', 'News banner', 'STRING'],
  ['hero_news_image_url', '', '', 'IMAGE_URL'],
  ['hero_news_illustration_url', '', '', 'IMAGE_URL'],
  ['hero_default_bg_url', '', '', 'IMAGE_URL'],
  ['hero_default_illustration_url', '', '', 'IMAGE_URL'],
].map(([key, value, valueEn, valueType]) => ({
  key,
  value,
  valueEn,
  valueType,
  settingGroup: 'public_hero',
}))

function renderScreen(props = {}) {
  const navigate = vi.fn()
  render(<BannerScreen canUpdate navigate={navigate} {...props} />)
  return { navigate }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.contentLang = 'vi'
  mocks.fetchSettings.mockResolvedValue({ items: pageSettings })
  mocks.batchUpdateSettings.mockImplementation(async (updates) => ({
    items: updates.map((update) => ({
      ...pageSettings.find((item) => item.key === update.key),
      value: update.value,
      valueEn: update.valueEn,
    })),
  }))
  mocks.showConfirm.mockResolvedValue(true)
})

describe('BannerScreen', () => {
  it('edits title and image alt in only the selected content language', async () => {
    renderScreen()

    const titles = await screen.findAllByLabelText('banners.fieldTitle')
    const alts = screen.getAllByLabelText('banners.fieldAlt')

    expect(titles).toHaveLength(3)
    expect(alts).toHaveLength(3)
    expect(titles[0]).toHaveValue('Tất cả sản phẩm')
    expect(alts[0]).toHaveValue('Banner tất cả sản phẩm')
    expect(screen.queryByText('banners.englishLabel')).not.toBeInTheDocument()
  })

  it('saves an English alt as valueEn without overwriting Vietnamese', async () => {
    const user = userEvent.setup()
    mocks.contentLang = 'en'
    renderScreen()

    const firstAlt = (await screen.findAllByLabelText('banners.fieldAlt'))[0]
    expect(firstAlt).toHaveValue('All products banner')
    await user.clear(firstAlt)
    await user.type(firstAlt, 'New English banner alt')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(mocks.batchUpdateSettings).toHaveBeenCalledWith([
      { key: 'hero_products_image_alt', valueEn: 'New English banner alt' },
    ]))
  })

  it('links only to the still-supported per-category banner editor', async () => {
    const user = userEvent.setup()
    const { navigate } = renderScreen()

    await user.click(await screen.findByRole('button', { name: 'banners.openCategories' }))
    expect(navigate).toHaveBeenCalledWith('/admin/categories')
    expect(screen.queryByRole('button', { name: 'banners.openContent' })).not.toBeInTheDocument()
  })

  it('shows a designed view-only state and disables all editable fields', async () => {
    renderScreen({ canUpdate: false })

    expect(await screen.findByText('banners.readOnlyHint')).toBeInTheDocument()
    for (const field of screen.getAllByLabelText('banners.fieldTitle')) {
      expect(field).toBeDisabled()
    }
    expect(screen.queryByRole('button', { name: 'common.save' })).not.toBeInTheDocument()
  })

  it('reports editor state to the parent without changing standalone behavior', async () => {
    const user = userEvent.setup()
    const onEditorStateChange = vi.fn()
    renderScreen({ embedded: true, onEditorStateChange })

    const firstTitle = (await screen.findAllByLabelText('banners.fieldTitle'))[0]
    await waitFor(() => expect(onEditorStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ dirtyCount: 0, saving: false }),
    ))

    await user.clear(firstTitle)
    await user.type(firstTitle, 'Banner mới')
    await waitFor(() => expect(onEditorStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ dirtyCount: 1, saving: false }),
    ))
  })
})
