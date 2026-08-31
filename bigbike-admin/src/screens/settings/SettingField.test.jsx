import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingField } from './SettingField'

const mocks = vi.hoisted(() => ({
  contentLang: 'vi',
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => values.defaultValue ?? key,
  }),
}))
vi.mock('../../lib/contentLang', () => ({
  useContentLang: () => mocks.contentLang,
}))
vi.mock('../../components/DeferredRichTextEditor', () => ({
  DeferredRichTextEditor: ({ value, onChange, placeholder, hasError }) => (
    <textarea
      aria-label="rich-editor"
      value={value}
      placeholder={placeholder}
      aria-invalid={hasError || undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))
vi.mock('../../components/ImageUrlInput', () => ({
  ImageUrlInput: ({ value, onChange, error }) => (
    <input
      aria-label="image-url"
      value={value}
      aria-invalid={error ? true : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

const baseSetting = {
  key: 'custom_value',
  value: 'Giá trị cũ',
  valueEn: 'Old value',
  valueType: 'STRING',
  settingGroup: 'GENERAL',
  description: 'Nhãn cài đặt',
}

function renderField(setting = baseSetting, props = {}) {
  const callbacks = {
    onChange: vi.fn(),
    onChangeEn: vi.fn(),
    onBlur: vi.fn(),
  }
  render(<SettingField setting={setting} where="Trang chủ" canUpdate {...callbacks} {...props} />)
  return callbacks
}

beforeEach(() => {
  mocks.contentLang = 'vi'
})

describe('SettingField', () => {
  it('renders an editable string with label, location, dirty state, and field error', async () => {
    const callbacks = renderField(baseSetting, {
      draft: 'Giá trị mới',
      error: 'Giá trị không hợp lệ',
    })

    const input = screen.getByLabelText('Nhãn cài đặt')
    expect(input).toHaveValue('Giá trị mới')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Trang chủ')).toBeInTheDocument()
    expect(screen.getByText('settings.unsavedDot')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Giá trị không hợp lệ')

    fireEvent.change(input, { target: { value: 'Đã sửa' } })
    expect(callbacks.onChange).toHaveBeenLastCalledWith('custom_value', 'Đã sửa')
    fireEvent.blur(input)
    expect(callbacks.onBlur).toHaveBeenCalled()
  })

  it('edits English content without overwriting the Vietnamese value', async () => {
    mocks.contentLang = 'en'
    const callbacks = renderField()

    const input = screen.getByLabelText('Nhãn cài đặt')
    expect(input).toHaveValue('Old value')
    fireEvent.change(input, { target: { value: 'New English value' } })

    expect(callbacks.onChangeEn).toHaveBeenLastCalledWith('custom_value', 'New English value')
    expect(callbacks.onChange).not.toHaveBeenCalled()
  })

  it('keeps boolean values compatible with the string API contract', async () => {
    const user = userEvent.setup()
    const setting = {
      ...baseSetting,
      key: 'feature_enabled',
      value: 'false',
      valueType: 'BOOLEAN',
    }
    const callbacks = renderField(setting)

    const toggle = screen.getByRole('switch', { name: 'Nhãn cài đặt' })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(callbacks.onChange).toHaveBeenCalledWith('feature_enabled', 'true')
  })

  it('uses full editors for long text, HTML, and image values', () => {
    const { unmount } = render(
      <SettingField
        setting={{ ...baseSetting, valueType: 'LONG_TEXT' }}
        where=""
        canUpdate
        onChange={vi.fn()}
        onChangeEn={vi.fn()}
        onBlur={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Nhãn cài đặt').tagName).toBe('TEXTAREA')
    unmount()

    const htmlRender = render(
      <SettingField
        setting={{ ...baseSetting, valueType: 'HTML' }}
        where=""
        canUpdate
        onChange={vi.fn()}
        onChangeEn={vi.fn()}
        onBlur={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('rich-editor')).toBeInTheDocument()
    htmlRender.unmount()

    render(
      <SettingField
        setting={{ ...baseSetting, valueType: 'IMAGE_URL' }}
        where=""
        canUpdate
        onChange={vi.fn()}
        onChangeEn={vi.fn()}
        onBlur={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('image-url')).toBeInTheDocument()
  })

  it('presents organized read-only values and safe empty fallbacks', () => {
    const { unmount } = render(
      <SettingField
        setting={{ ...baseSetting, value: 'true', valueType: 'BOOLEAN' }}
        where=""
        canUpdate={false}
        onChange={vi.fn()}
        onChangeEn={vi.fn()}
      />,
    )
    expect(screen.getByText('settings.boolOn')).toBeInTheDocument()
    unmount()

    const emptyRender = render(
      <SettingField
        setting={{ ...baseSetting, value: '', valueType: 'STRING' }}
        where=""
        canUpdate={false}
        onChange={vi.fn()}
        onChangeEn={vi.fn()}
      />,
    )
    expect(screen.getByText('settings.valueEmpty')).toBeInTheDocument()
    emptyRender.unmount()

    render(
      <SettingField
        setting={{ ...baseSetting, value: '', valueType: 'IMAGE_URL' }}
        where=""
        canUpdate={false}
        onChange={vi.fn()}
        onChangeEn={vi.fn()}
      />,
    )
    expect(screen.getByText('Chưa có ảnh được chọn')).toBeInTheDocument()
  })
})
