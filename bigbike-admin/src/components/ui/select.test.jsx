import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@radix-ui/react-select', () => {
  const Primitive = ({ children }) => children ?? null

  return {
    Root: ({ onValueChange }) => (
      <div>
        <button type="button" onClick={() => onValueChange('')}>
          emit empty value
        </button>
        <button type="button" onClick={() => onValueChange('PUBLISHED')}>
          emit published value
        </button>
        <button type="button" onClick={() => onValueChange('__none__')}>
          emit explicit empty option
        </button>
      </div>
    ),
    Group: Primitive,
    Value: Primitive,
    Trigger: Primitive,
    Icon: Primitive,
    ScrollUpButton: Primitive,
    ScrollDownButton: Primitive,
    Portal: Primitive,
    Content: Primitive,
    Viewport: Primitive,
    Label: Primitive,
    Item: Primitive,
    ItemIndicator: Primitive,
    ItemText: Primitive,
    Separator: Primitive,
  }
})

import { Select } from './select'

describe('Select', () => {
  it('không chuyển giá trị rỗng nội bộ của Radix vào biểu mẫu, nhưng giữ các giá trị hợp lệ', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(<Select value="PUBLISHED" onValueChange={onValueChange} />)

    await user.click(screen.getByRole('button', { name: 'emit empty value' }))
    expect(onValueChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'emit published value' }))
    await user.click(screen.getByRole('button', { name: 'emit explicit empty option' }))

    expect(onValueChange).toHaveBeenNthCalledWith(1, 'PUBLISHED')
    expect(onValueChange).toHaveBeenNthCalledWith(2, '__none__')
  })
})
