import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render as baseRender, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { SettingTabPanel } from './SettingTabPanel'
import { fetchChatStats } from '@/lib/adminApi'
const auth = vi.hoisted(() => ({ hasPermission: vi.fn() }))
vi.mock('@/lib/auth', () => ({ useHasPermission: () => auth.hasPermission }))
vi.mock('@/lib/adminApi', () => ({ fetchChatStats: vi.fn() }))

function render(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return baseRender(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) =>
      key === 'chatAdmin.imageQuota.usage'
        ? `${values.used}/${values.limit}, còn ${values.remaining}, ${values.date}`
        : (values.defaultValue ?? key),
  }),
}))
vi.mock('./SettingField', () => ({
  SettingField: ({ setting, error }) => (
    <div data-testid={`field-${setting.key}`}>
      {setting.key}
      {error ? <span role="alert">{error}</span> : null}
    </div>
  ),
}))

const items = [
  {
    key: 'site_name',
    value: 'BigBike',
    valueEn: 'BigBike',
    valueType: 'STRING',
    settingGroup: 'GENERAL',
  },
  {
    key: 'home_content_bottom_html',
    value: '<p>Nội dung</p>',
    valueEn: '<p>Content</p>',
    valueType: 'HTML',
    settingGroup: 'SEO',
  },
]

function panelProps(overrides = {}) {
  return {
    title: 'Cài đặt chung',
    description: 'Mô tả nhóm',
    items,
    canUpdate: true,
    drafts: {},
    draftsEn: {},
    errors: {},
    onDraftChange: vi.fn(),
    onDraftChangeEn: vi.fn(),
    onDraftBlur: vi.fn(),
    onSave: vi.fn(),
    onDiscard: vi.fn(),
    saving: false,
    saveSuccess: false,
    saveError: '',
    ...overrides,
  }
}

describe('SettingTabPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.hasPermission.mockImplementation((permission) => permission === 'settings.read')
  })
  it('keeps the first section open and lets later sections collapse', async () => {
    const user = userEvent.setup()
    render(<SettingTabPanel {...panelProps()} />)

    expect(screen.getByTestId('field-site_name')).toBeVisible()
    const seoToggle = screen.getByRole('button', { name: /Nội dung SEO cuối trang chủ/ })
    expect(seoToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('field-home_content_bottom_html')).not.toBeVisible()

    await user.click(seoToggle)
    expect(seoToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('field-home_content_bottom_html')).toBeVisible()
  })

  it('automatically opens a collapsed section that contains an error', () => {
    render(
      <SettingTabPanel
        {...panelProps({
          errors: { home_content_bottom_html: 'Nội dung không hợp lệ' },
        })}
      />,
    )

    const seoToggle = screen.getByRole('button', { name: /Nội dung SEO cuối trang chủ/ })
    expect(seoToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Nội dung không hợp lệ')
  })

  it('prioritizes error, saving, success, and unsaved action states', () => {
    const dirtyProps = panelProps({ drafts: { site_name: 'BigBike mới' } })
    const { rerender } = render(<SettingTabPanel {...dirtyProps} />)

    expect(screen.getByRole('toolbar')).toHaveTextContent('settings.unsavedCount')
    expect(screen.getByRole('button', { name: 'settings.saveCount' })).toBeEnabled()

    rerender(<SettingTabPanel {...dirtyProps} saving />)
    expect(screen.getByRole('toolbar')).toHaveTextContent('Đang lưu thay đổi…')

    rerender(<SettingTabPanel {...dirtyProps} saving saveError="Không thể lưu" />)
    expect(screen.getByRole('toolbar')).toHaveTextContent('Không thể lưu')
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể lưu')

    rerender(<SettingTabPanel {...panelProps({ saveSuccess: true })} />)
    expect(screen.getByRole('toolbar')).toHaveTextContent('settings.saveSuccess')
    expect(screen.queryByRole('button', { name: 'settings.saveCount' })).not.toBeInTheDocument()
  })
  it('shows actual image usage to settings readers without granting access to photos', async () => {
    vi.mocked(fetchChatStats).mockResolvedValue({
      date: '2026-09-08',
      images: { used: 21, limit: 60, remaining: 39 },
    })
    render(
      <SettingTabPanel
        {...panelProps({
          canUpdate: false,
          items: [
            { key: 'ai_assistant_image_daily_limit', value: '60', settingGroup: 'AI_ASSISTANT' },
          ],
        })}
      />,
    )
    expect(await screen.findByText('21/60, còn 39, 2026-09-08')).toBeVisible()
    expect(fetchChatStats).toHaveBeenCalledTimes(1)
  })

  it('does not invent zero usage when stats are missing and permits retry', async () => {
    vi.mocked(fetchChatStats)
      .mockResolvedValueOnce({ images: null })
      .mockResolvedValue({ date: '2026-09-08', images: { used: 60, limit: 60, remaining: 0 } })
    const user = userEvent.setup()
    render(
      <SettingTabPanel
        {...panelProps({
          items: [
            { key: 'ai_assistant_image_daily_limit', value: '60', settingGroup: 'AI_ASSISTANT' },
          ],
        })}
      />,
    )
    expect(await screen.findByText('chatAdmin.imageQuota.error')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'common.retry' }))
    expect(await screen.findByText('60/60, còn 0, 2026-09-08')).toBeVisible()
  })

  it('does not request stats without either read permission', () => {
    auth.hasPermission.mockReturnValue(false)
    render(
      <SettingTabPanel
        {...panelProps({
          items: [
            { key: 'ai_assistant_image_daily_limit', value: '60', settingGroup: 'AI_ASSISTANT' },
          ],
        })}
      />,
    )
    expect(screen.getByText('chatAdmin.imageQuota.permission')).toBeVisible()
    expect(fetchChatStats).not.toHaveBeenCalled()
  })
})
