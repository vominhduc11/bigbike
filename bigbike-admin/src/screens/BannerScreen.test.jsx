import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render as testingRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BannerScreen } from './BannerScreen'
import { ApiClientError } from '../lib/adminApi'

const mocks = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  batchUpdateSettings: vi.fn(),
  showConfirm: vi.fn(),
  contentLang: 'vi',
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => {
      if (values.lng && key === 'banners.pageProducts')
        return values.lng === 'en' ? 'All products' : 'Tất cả sản phẩm'
      return values.defaultValue ?? key
    },
  }),
}))
vi.mock('../lib/adminApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchSettings: mocks.fetchSettings,
  batchUpdateSettings: mocks.batchUpdateSettings,
}))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: vi.fn() }))
vi.mock('@/lib/contentLang', () => ({
  useContentLang: () => mocks.contentLang,
  getContentLang: () => mocks.contentLang,
  setContentLang: vi.fn(),
}))
vi.mock('@/lib/contracts', () => ({ resolveDisplayUrl: (value) => value }))
vi.mock('../components/ImageUrlInput', () => ({
  ImageUrlInput: ({ value, disabled, onChange, previewUrl, recommend, error }) => (
    <>
      <input
        aria-label={`image-${value || 'empty'}`}
        value={value || ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        data-preview-url={previewUrl}
        data-recommend-width={recommend?.idealW}
      />
      {error ? <span role="alert">{error}</span> : null}
    </>
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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = testingRender(
    <QueryClientProvider client={client}>
      <BannerScreen canUpdate navigate={navigate} {...props} />
    </QueryClientProvider>,
  )
  return {
    navigate,
    client,
    ...view,
    rerenderScreen: () =>
      view.rerender(
        <QueryClientProvider client={client}>
          <BannerScreen canUpdate navigate={navigate} {...props} />
        </QueryClientProvider>,
      ),
  }
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

    await waitFor(() =>
      expect(mocks.batchUpdateSettings).toHaveBeenCalledWith([
        { key: 'hero_products_image_alt', valueEn: 'New English banner alt' },
      ]),
    )
  })

  it('omits a reverted Vietnamese draft when only English changed', async () => {
    const user = userEvent.setup()
    const { rerenderScreen } = renderScreen()
    const viTitle = (await screen.findAllByLabelText('banners.fieldTitle'))[0]
    await user.type(viTitle, ' thêm')
    await user.clear(viTitle)
    await user.type(viTitle, 'Tất cả sản phẩm')
    mocks.contentLang = 'en'
    rerenderScreen()
    await user.type(screen.getAllByLabelText('banners.fieldTitle')[0], ' new')
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() =>
      expect(mocks.batchUpdateSettings).toHaveBeenCalledWith([
        { key: 'hero_products_title', valueEn: 'All products new' },
      ]),
    )
  })

  it('keeps unindexed errors at form level without assigning a field by message text', async () => {
    mocks.batchUpdateSettings.mockRejectedValue(
      new ApiClientError('Invalid', 400, 'VALIDATION_ERROR', [
        { field: 'value', code: 'INVALID_VALUE', message: 'hero_products_title is invalid' },
      ]),
    )
    const user = userEvent.setup()
    renderScreen()
    const title = (await screen.findAllByLabelText('banners.fieldTitle'))[0]
    await user.type(title, ' new')
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    expect(await screen.findByText('hero_products_title is invalid')).toBeInTheDocument()
    expect(title).not.toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveValue('Tất cả sản phẩm new')
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
    await waitFor(() =>
      expect(onEditorStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ dirtyCount: 0, saving: false }),
      ),
    )

    await user.clear(firstTitle)
    await user.type(firstTitle, 'Banner mới')
    await waitFor(() =>
      expect(onEditorStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ dirtyCount: 1, saving: false }),
      ),
    )
  })
})

describe('BannerScreen regressions', () => {
  it('locks every field while saving, prevents duplicate saves, and unlocks after success', async () => {
    let complete
    mocks.batchUpdateSettings.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    const user = userEvent.setup()
    const { client } = renderScreen()
    const firstTitle = (await screen.findAllByLabelText('banners.fieldTitle'))[0]
    await user.clear(firstTitle)
    await user.type(firstTitle, 'Saved title')
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    for (const control of screen.getAllByRole('textbox')) expect(control).toBeDisabled()
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    // Even a late/programmatic change must not mutate the submitted draft.
    fireEvent.change(firstTitle, { target: { value: 'Late change' } })
    expect(firstTitle).toHaveValue('Saved title')
    expect(mocks.batchUpdateSettings).toHaveBeenCalledOnce()
    await act(async () => complete({ items: [{ ...pageSettings[0], value: 'Saved title' }] }))
    expect(firstTitle).toBeEnabled()
    expect(firstTitle).toHaveValue('Saved title')
    expect(client.getQueryData(['settings']).items[0].value).toBe('Saved title')
    expect(screen.getByText('banners.saveSuccess')).toBeInTheDocument()
  })

  it('keeps both languages after a failed save and allows a retry', async () => {
    const user = userEvent.setup()
    mocks.batchUpdateSettings.mockRejectedValueOnce(new Error('Network failure'))
    const { rerenderScreen } = renderScreen()
    let firstTitle = (await screen.findAllByLabelText('banners.fieldTitle'))[0]
    await user.clear(firstTitle)
    await user.type(firstTitle, 'Bản nháp VI')
    mocks.contentLang = 'en'
    rerenderScreen()
    firstTitle = screen.getAllByLabelText('banners.fieldTitle')[0]
    await user.clear(firstTitle)
    await user.type(firstTitle, 'English draft')
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    expect(await screen.findByText('Network failure')).toBeInTheDocument()
    expect(firstTitle).toBeEnabled()
    expect(firstTitle).toHaveValue('English draft')
    mocks.contentLang = 'vi'
    rerenderScreen()
    expect(screen.getAllByLabelText('banners.fieldTitle')[0]).toHaveValue('Bản nháp VI')
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    expect(await screen.findByText('banners.saveSuccess')).toBeInTheDocument()
    expect(mocks.batchUpdateSettings).toHaveBeenLastCalledWith([
      { key: 'hero_products_title', value: 'Bản nháp VI', valueEn: 'English draft' },
    ])
  })

  it('uses a Vietnamese draft for blank EN preview without filling the English input', async () => {
    mocks.fetchSettings.mockResolvedValue({
      items: pageSettings.map((item) =>
        item.key === 'hero_products_title' ? { ...item, valueEn: '' } : item,
      ),
    })
    const user = userEvent.setup()
    const { container, rerenderScreen } = renderScreen()
    const title = (await screen.findAllByLabelText('banners.fieldTitle'))[0]
    await user.clear(title)
    await user.type(title, 'Bản nháp VI')
    mocks.contentLang = 'en'
    rerenderScreen()
    expect(screen.getAllByLabelText('banners.fieldTitle')[0]).toHaveValue('')
    expect(container.querySelector('[data-banner-title]')).toHaveTextContent('Bản nháp VI')
    mocks.contentLang = 'vi'
    rerenderScreen()
    await user.clear(screen.getAllByLabelText('banners.fieldTitle')[0])
    mocks.contentLang = 'en'
    rerenderScreen()
    expect(container.querySelector('[data-banner-title]')).toHaveTextContent('All products')
    expect(screen.getAllByLabelText('banners.fieldTitle')[0]).toHaveValue('')
  })

  it('maps indexed English errors to the exact submitted field and clears only the edited error', async () => {
    mocks.contentLang = 'en'
    mocks.batchUpdateSettings.mockRejectedValue(
      new ApiClientError('Invalid', 400, 'VALIDATION_ERROR', [
        { field: 'updates[0].valueEn', code: 'INVALID_VALUE', message: 'Title error' },
        { field: 'updates[1].valueEn', code: 'INVALID_VALUE', message: 'Alt error' },
      ]),
    )
    const user = userEvent.setup()
    const { rerenderScreen } = renderScreen()
    const title = (await screen.findAllByLabelText('banners.fieldTitle'))[0]
    const alt = screen.getAllByLabelText('banners.fieldAlt')[2]
    await user.type(title, ' new')
    await user.type(alt, ' new')
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    expect(await screen.findByText('Title error')).toBeInTheDocument()
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(alt).toHaveAttribute('aria-invalid', 'true')
    await user.type(alt, ' corrected')
    expect(screen.queryByText('Alt error')).not.toBeInTheDocument()
    expect(screen.getByText('Title error')).toBeInTheDocument()
    expect(alt).not.toHaveAttribute('aria-invalid', 'true')
    mocks.contentLang = 'vi'
    rerenderScreen()
    expect(screen.getByRole('button', { name: 'banners.reviewOtherLanguage' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('banners.fieldTitle')[0]).not.toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('marks a rejected image, preserves its URL, and uses normalized display URLs and shared recommendations', async () => {
    mocks.contentLang = 'en'
    const legacy = 'https://bigbike.vn/wp-content/themes/bigbike/images/page-title-bg.png'
    mocks.fetchSettings.mockResolvedValue({
      items: pageSettings.map((item) =>
        item.key === 'hero_default_bg_url' ? { ...item, value: legacy } : item,
      ),
    })
    mocks.batchUpdateSettings.mockRejectedValue(
      new ApiClientError('Invalid', 400, 'VALIDATION_ERROR', [
        { field: 'updates[0].value', code: 'INVALID_VALUE', message: 'Image error' },
      ]),
    )
    const user = userEvent.setup()
    const { container } = renderScreen()
    const input = await screen.findByLabelText(`image-${legacy}`)
    expect(input).toHaveAttribute(
      'data-preview-url',
      expect.stringContaining('/brand/page-title-bg.png'),
    )
    expect(input).toHaveAttribute('data-recommend-width', '3840')
    expect(container.querySelector('[data-banner-image="background"]')).toHaveAttribute(
      'src',
      expect.stringContaining('/brand/page-title-bg.png'),
    )
    fireEvent.change(input, { target: { value: 'https://example.com/banner.png' } })
    await user.click(screen.getByRole('button', { name: 'common.save' }))
    expect(await screen.findByText('Image error')).toBeInTheDocument()
    expect(input).toHaveValue('https://example.com/banner.png')
    expect(
      screen.queryByRole('button', { name: 'banners.reviewOtherLanguage' }),
    ).not.toBeInTheDocument()
  })

  it('shows explicit composite image loading and failure states', async () => {
    const { container } = renderScreen()
    await screen.findAllByLabelText('banners.fieldTitle')
    const bg = container.querySelector('[data-banner-image="background"]')
    expect(bg).toHaveAttribute('data-image-status', 'loading')
    fireEvent.error(bg)
    expect(bg).toHaveAttribute('data-image-status', 'error')
    expect(screen.getByText('imageInput.previewError')).toBeInTheDocument()
    fireEvent.load(bg)
    expect(bg).toHaveAttribute('data-image-status', 'ready')
  })
})
