import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ProductExportDialog } from './ProductExportDialog'
import viLocale from '../locales/vi.json'
import enLocale from '../locales/en.json'
import { PRODUCT_EXPORT_HEADERS } from '../lib/productExport'

const mocks = vi.hoisted(() => ({ locale: null }))

function translate(locale, key, options = {}) {
  const value = key.split('.').reduce((current, part) => current?.[part], locale)
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options[name] ?? ''))
  }
  return options.defaultValue ?? key
}

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key, options) => translate(mocks.locale, key, options) }),
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }) => (
    <input
      type="checkbox"
      checked={checked === true}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }) => <p>{children}</p>,
  DialogFooter: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}))

vi.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({ children }) => <div>{children}</div>,
  RadioGroupItem: ({ value, ...props }) => <input type="radio" value={value} {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }) => <div role="alert">{children}</div>,
}))

vi.mock('@/components/ExportButton', () => ({
  ExportButton: ({ children, onExport, disabled }) => (
    <button type="button" disabled={disabled} onClick={onExport}>
      {children}
    </button>
  ),
}))

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  query: { publishStatus: 'ALL' },
  totalItems: 5,
  selectedIds: [],
  preferences: {
    preset: 'PRICING',
    columns: null,
    includeDraft: false,
    includeTrash: false,
  },
  onPreferencesChange: vi.fn(),
  onExport: vi.fn().mockResolvedValue(undefined),
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.locale = viLocale
})

describe('ProductExportDialog', () => {
  it.each([
    ['Vietnamese', viLocale],
    ['English', enLocale],
  ])('has a business label for every export header in %s', (_, locale) => {
    const labels = locale.products.exportDialog.columnLabels
    const missing = PRODUCT_EXPORT_HEADERS.filter((header) => !labels[header])

    expect(missing).toEqual([])
    expect(Object.keys(labels)).toHaveLength(PRODUCT_EXPORT_HEADERS.length)
  })

  it('shows business labels with technical headers as secondary reconciliation text', () => {
    render(<ProductExportDialog {...defaultProps} />)

    expect(screen.getByText('Xuất danh sách sản phẩm')).toBeInTheDocument()
    expect(screen.getByText('Nội dung & hiển thị trên Google')).toBeInTheDocument()
    expect(screen.getByText('Mã sản phẩm (SKU)')).toBeInTheDocument()
    expect(screen.getByText('sku')).toBeInTheDocument()
    expect(
      screen.getByText('Tên kỹ thuật màu xám chỉ dùng để đối chiếu với tên cột trong file.'),
    ).toBeInTheDocument()

    const skuCheckbox = screen.getByRole('checkbox', { name: 'Mã sản phẩm (SKU) (sku)' })
    expect(skuCheckbox).toBeDisabled()
  })

  it('searches by business label and by technical header', () => {
    render(<ProductExportDialog {...defaultProps} />)
    const search = screen.getByRole('textbox', { name: 'Tìm nhanh thông tin' })

    fireEvent.change(search, { target: { value: 'thương hiệu' } })
    expect(screen.getByText('Danh mục & thương hiệu')).toBeInTheDocument()
    expect(screen.getByText('Thương hiệu')).toBeInTheDocument()
    expect(screen.queryByText('Giá niêm yết')).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'seo_og_image_url' } })
    expect(screen.getByText('Ảnh chia sẻ mạng xã hội')).toBeInTheDocument()
  })
})
