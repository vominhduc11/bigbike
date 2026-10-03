import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VariantsEditor } from './VariantEditors'
import { reconcileChoices, getChoiceErrors } from './variantMatrixUtils'

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), changed: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'vi' } }),
}))
vi.mock('../../lib/confirm', () => ({ showConfirm: mocks.confirm }))
vi.mock('./ContentEditors', () => ({ GalleryEditor: () => null }))
vi.mock('../../lib/adminApi', async (original) => ({
  ...(await original()),
  fetchAttributes: async () => [
    { id: 'color', name: 'Màu sắc', code: 'color' },
    { id: 'size', name: 'Size', code: 'size' },
    { id: 'model', name: 'Đời máy', code: 'model' },
    { id: 'iphone', name: 'iPhone', code: 'iphone' },
  ],
  fetchAttributeValues: async (id) =>
    id === 'color'
      ? [
          { id: 'black', label: 'Đen', slug: 'den' },
          { id: 'red', label: 'Đỏ', slug: 'do' },
        ]
      : [
          { id: 'm', label: 'M', slug: 'm' },
          { id: 'l', label: 'L', slug: 'l' },
          { id: 'shoe', label: '42', slug: '42' },
        ],
  fetchSizeScaleGroups: async () => [],
}))

const scales = [{ id: 'helmet', name: 'Cỡ mũ', values: [{ label: 'M' }, { label: 'L' }] }]
const dimensions = [
  { name: 'Màu sắc', valueIds: ['black'], values: ['Đen'] },
  { name: 'Size', valueIds: ['m', 'l'], values: ['M', 'L'] },
]
function Harness({ initial = [], disabled = false }) {
  const [items, setItems] = useState(initial)
  const [sizeScaleId, setSizeScaleId] = useState('helmet')
  return (
    <VariantsEditor
      items={items}
      onChange={(next) => {
        mocks.changed(next)
        setItems(next)
      }}
      disabled={disabled}
      contentLang="vi"
      productSku="E2E-HELMET"
      commonRetailPrice="2000000"
      sizeScaleId={sizeScaleId}
      sizeScales={scales}
      onSizeScaleChange={setSizeScaleId}
    />
  )
}
function mount(props) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocks.changed.mockReset()
  mocks.confirm.mockReset().mockResolvedValue(false)
})

describe('product choices workflow', () => {
  it('keeps color before size in generated names and SKUs even when size was selected first', () => {
    expect(reconcileChoices([], [...dimensions].reverse(), 'ROOT').rows[0]).toMatchObject({
      name: 'Đen - M',
      sku: 'ROOT-DEN-M',
    })
  })
  it('starts with the selling decision and keeps a single product free of empty tables', async () => {
    mount()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'products.detail.choices.single' }))
    expect(screen.getByText('products.detail.choices.singleHint')).toBeInTheDocument()
    expect(mocks.changed).not.toHaveBeenCalled()
  })

  it('keeps distinct backend types selectable when legacy aliases share a group', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'products.detail.choices.multiple' }))
    const model = screen.getByRole('checkbox', { name: 'Đời máy', exact: true })
    const iphone = screen.getByRole('checkbox', { name: 'iPhone', exact: true })
    await userEvent.click(model)
    await userEvent.click(iphone)
    expect(model).toHaveAttribute('aria-checked', 'true')
    expect(iphone).toHaveAttribute('aria-checked', 'true')
  })

  it('selects colors and valid sizes before generating named options with inherited prices', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'products.detail.choices.multiple' }))
    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'products.detail.choices.color' }),
    )
    expect(screen.queryByLabelText('products.detail.sizeScale.label')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'products.detail.choices.size' }))
    expect(screen.getByLabelText('products.detail.sizeScale.label')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Đen' }))
    expect(mocks.changed).not.toHaveBeenCalled()
    expect(screen.queryByRole('checkbox', { name: '42' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'M', exact: true }))
    await waitFor(() => expect(mocks.changed).toHaveBeenCalled())
    const row = mocks.changed.mock.lastCall[0][0]
    expect(row).toMatchObject({
      name: 'Đen - M',
      sku: 'E2E-HELMET-DEN-M',
      retailPrice: '',
      salePrice: '',
      isAvailable: true,
    })
    expect(screen.getAllByPlaceholderText('2.000.000').length).toBeGreaterThan(0)
    expect(screen.queryByText('products.detail.variant.duplicate')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('products.detail.variant.selectAllRows')).not.toBeInTheDocument()
  })

  it('opening existing choices never changes their IDs, SKUs, prices or images', async () => {
    const row = {
      ...reconcileChoices([], dimensions, 'ROOT').rows[0],
      id: 'saved',
      sku: 'CUSTOM',
      retailPrice: '2400000',
      imageUrl: '/media/saved.jpg',
    }
    mount({ initial: [row] })
    await screen.findByRole('checkbox', { name: 'Đen' })
    expect(mocks.changed).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Đen' }))
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled())
    expect(mocks.changed).not.toHaveBeenCalled()
  })

  it('preserves matching saved rows and shares color images when another size is added', () => {
    const saved = {
      ...reconcileChoices([], dimensions, 'ROOT').rows[0],
      id: 'saved',
      sku: 'CUSTOM',
      retailPrice: '2400000',
      imageUrl: '/media/saved.jpg',
      isAvailable: false,
    }
    const result = reconcileChoices([saved], dimensions, 'ROOT')
    expect(result.removed).toEqual([])
    expect(result.rows[0]).toBe(saved)
    expect(result.rows[1]).toMatchObject({
      name: 'Đen - L',
      retailPrice: '',
      imageUrl: '/media/saved.jpg',
      isAvailable: true,
    })
  })

  it('reports case-insensitive duplicate SKUs and missing color images immediately', () => {
    const rows = reconcileChoices([], dimensions, 'ROOT').rows
    rows[0].sku = ' SAME '
    rows[1].sku = 'same'
    const errors = getChoiceErrors(rows, (key) => key)
    expect(errors['variants.0.sku']).toBe('products.detail.errVariantSkuDuplicate')
    expect(errors['variants.1.sku']).toBe('products.detail.errVariantSkuDuplicate')
    expect(errors['variants.0.imageUrl']).toBe('products.detail.choices.imageBeforePublish')
  })
})
