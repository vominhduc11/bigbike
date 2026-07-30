import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingTabPanel } from './SettingTabPanel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => values.defaultValue ?? key,
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
})
