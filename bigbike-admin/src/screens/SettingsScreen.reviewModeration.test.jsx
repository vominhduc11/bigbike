import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from './SettingsScreen'
import { getAutosaveKey, saveFormToStorage } from './settings/constants'
import viLocale from '../locales/vi.json'
import enLocale from '../locales/en.json'

const mocks = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  batchUpdateSettings: vi.fn(),
  useUnsavedChanges: vi.fn(),
}))

vi.mock('../lib/adminApi', () => ({
  fetchSettings: mocks.fetchSettings,
  batchUpdateSettings: mocks.batchUpdateSettings,
}))
vi.mock('../lib/contentLang', () => ({
  useContentLang: () => 'vi',
  setContentLang: vi.fn(),
}))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: mocks.useUnsavedChanges }))
vi.mock('@/lib/useSaveShortcut', () => ({ useSaveShortcut: vi.fn() }))
vi.mock('./BannerScreen', () => ({ BannerScreen: () => <p>Banner editor</p> }))
vi.mock('./AssignmentRolesScreen', () => ({
  AssignmentRolesScreen: () => <p>Assignment editor</p>,
}))

const moderationRows = [
  ['review_moderation_enabled', 'false', 'BOOLEAN'],
  ['review_moderation_block_profanity', 'false', 'BOOLEAN'],
  ['review_moderation_block_harassment', 'false', 'BOOLEAN'],
  ['review_moderation_block_advertising', 'false', 'BOOLEAN'],
  ['review_moderation_block_sensitive', 'false', 'BOOLEAN'],
  ['review_moderation_daily_limit', '37', 'INTEGER'],
  ['review_moderation_banned_words', 'từ cấm', 'LONG_TEXT'],
].map(([key, value, valueType]) => ({ key, value, valueType, settingGroup: 'review_moderation' }))

const settings = [
  {
    key: 'site_name',
    value: 'BigBike',
    valueEn: 'BigBike',
    valueType: 'STRING',
    settingGroup: 'general',
  },
  {
    key: 'footer_description',
    value: 'Mô tả shop',
    valueType: 'LONG_TEXT',
    settingGroup: 'general',
  },
  ...moderationRows,
]

async function renderScreen(language = 'vi', props = {}) {
  const i18n = createInstance().use(initReactI18next)
  await i18n.init({
    lng: language,
    fallbackLng: 'vi',
    resources: { vi: { translation: viLocale }, en: { translation: enLocale } },
    interpolation: { escapeValue: false },
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <SettingsScreen canUpdate isSuperAdmin={false} navigate={vi.fn()} {...props} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
  return i18n
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  mocks.fetchSettings.mockResolvedValue({ items: settings })
  mocks.batchUpdateSettings.mockImplementation(async (updates) => ({
    items: updates.map((update) => ({
      ...settings.find((item) => item.key === update.key),
      ...update,
    })),
  }))
})

describe('retired review moderation Settings editor', () => {
  it.each([
    ['vi', false],
    ['vi', true],
    ['en', false],
    ['en', true],
  ])(
    'hides desktop/mobile controls in %s (super admin: %s) despite API rows',
    async (language, isSuperAdmin) => {
      window.history.replaceState(null, '', '/?group=review_moderation')
      const i18n = await renderScreen(language, { isSuperAdmin })
      const generalLabel = i18n.t('settings.group_general')
      const general = await screen.findByRole('button', { name: generalLabel })

      expect(general).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('tab', { name: generalLabel })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      for (const navigation of [screen.getByRole('navigation'), screen.getByRole('tablist')]) {
        expect(
          within(navigation).queryByText(/Kiểm duyệt đánh giá|Review moderation|REVIEW_MODERATION/),
        ).not.toBeInTheDocument()
      }
      for (const row of moderationRows) {
        expect(screen.queryByText(row.key)).not.toBeInTheDocument()
      }
      expect(screen.queryByText('từ cấm')).not.toBeInTheDocument()
      expect(screen.queryByText('Bật kiểm duyệt tự động')).not.toBeInTheDocument()
      expect(mocks.batchUpdateSettings).not.toHaveBeenCalled()
    },
  )

  it('falls back to the first valid tab when General is absent', async () => {
    mocks.fetchSettings.mockResolvedValue({ items: moderationRows })
    window.history.replaceState(null, '', '/?group=review_moderation')
    const i18n = await renderScreen()

    expect(await screen.findByText('Banner editor')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: i18n.t('settings.group_public_hero') })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('ignores retired-only drafts without prompting recovery or blocking navigation', async () => {
    saveFormToStorage(getAutosaveKey(), {
      drafts: { review_moderation_enabled: 'true', review_moderation_daily_limit: '999' },
      draftsEn: { review_moderation_banned_words: 'old words' },
    })
    await renderScreen()
    await screen.findByRole('button', { name: 'Thông tin shop' })

    expect(screen.queryByText('Có bản nháp tạm')).not.toBeInTheDocument()
    expect(mocks.useUnsavedChanges).toHaveBeenLastCalledWith(false)
    expect(mocks.batchUpdateSettings).not.toHaveBeenCalled()
  })

  it('restores and saves remaining settings without submitting any moderation values', async () => {
    const user = userEvent.setup()
    saveFormToStorage(getAutosaveKey(), {
      drafts: { footer_description: 'Mô tả mới', review_moderation_daily_limit: '999' },
      draftsEn: { review_moderation_banned_words: 'old words' },
    })
    await renderScreen()
    await user.click(await screen.findByRole('button', { name: 'Khôi phục' }))
    await user.click(screen.getByRole('button', { name: 'Lưu (1)' }))

    await waitFor(() =>
      expect(mocks.batchUpdateSettings).toHaveBeenCalledWith([
        { key: 'footer_description', value: 'Mô tả mới' },
      ]),
    )
    await waitFor(() => expect(mocks.useUnsavedChanges).toHaveBeenLastCalledWith(false))
    expect(moderationRows.map((row) => row.value)).toEqual([
      'false',
      'false',
      'false',
      'false',
      'false',
      '37',
      'từ cấm',
    ])
  })
})
