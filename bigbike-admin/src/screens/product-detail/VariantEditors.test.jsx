import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { normalizeSizeScaleValue, parseSizeScaleValues } from './sizeScaleUtils'
import { VariantMatrixWizard } from './VariantEditors'

describe('size scale value parser', () => {
  it('keeps the comma-separated order and trims labels', () => {
    expect(parseSizeScaleValues(' XS, S, M, L ')).toEqual({
      values: ['XS', 'S', 'M', 'L'],
      duplicate: '',
    })
  })

  it('detects canonical duplicates such as M/m and 2XL/XXL', () => {
    expect(parseSizeScaleValues('S, M, m')).toEqual({
      values: ['S', 'M', 'm'],
      duplicate: 'm',
    })
    expect(normalizeSizeScaleValue('2XL')).toBe('XXL')
    expect(parseSizeScaleValues('XL, 2XL, XXL').duplicate).toBe('XXL')
  })
})

describe('variant matrix money input', () => {
  it('passes the shared price to the local form callback without a mutation', async () => {
    const user = userEvent.setup()
    const onGenerate = vi.fn()
    const onClose = vi.fn()

    render(<VariantMatrixWizard onGenerate={onGenerate} onClose={onClose} />)

    const fields = screen.getAllByRole('textbox')
    await user.type(fields[0], 'Màu')
    await user.type(fields[1], 'Đỏ,Xanh')
    await user.type(fields[2], 'Kích thước')
    await user.type(fields[3], 'M')
    await user.click(fields[5])
    fireEvent.change(fields[5], { target: { value: '2.000.000', selectionStart: 9, selectionEnd: 9 } })

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[buttons.length - 1])

    expect(onGenerate).toHaveBeenCalledTimes(1)
    expect(onGenerate.mock.calls[0][0]).toHaveLength(2)
    expect(onGenerate.mock.calls[0][0][0]).toMatchObject({
      retailPrice: '2000000',
      salePrice: '',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
