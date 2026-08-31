import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from '@/components/ui/input'
import { FormField } from './FormField'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => (key === 'common.moreInformation' ? 'Xem giải thích' : key),
  }),
}))

describe('FormField helper copy', () => {
  it('keeps a short, useful helper visible', () => {
    render(
      <FormField label="SKU" helper="Mã dùng để đối soát kho.">
        <Input />
      </FormField>,
    )

    expect(screen.getByText('Mã dùng để đối soát kho.')).not.toHaveClass('sr-only')
  })

  it('moves a long helper to the shared tooltip and keeps it accessible to the field', () => {
    const helper =
      'Hướng dẫn dài hơn tám mươi ký tự được thu gọn để biểu mẫu dễ quét nhưng vẫn còn đầy đủ cho người cần xem.'
    render(
      <FormField label="Mô tả" helper={helper}>
        <Input />
      </FormField>,
    )

    const input = screen.getByRole('textbox')
    const helperText = screen.getByText(helper)
    expect(helperText).toHaveClass('sr-only')
    expect(input).toHaveAttribute('aria-describedby', helperText.id)
    expect(screen.getByRole('button', { name: 'Xem giải thích' })).toBeInTheDocument()
  })
})
