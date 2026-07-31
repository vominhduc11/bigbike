import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('mặc định không submit form dùng chung trong admin', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event) => event.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <Button>Mở thao tác phụ</Button>
      </form>,
    )

    const button = screen.getByRole('button', { name: 'Mở thao tác phụ' })
    expect(button).toHaveAttribute('type', 'button')

    await user.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('vẫn cho phép khai báo submit tường minh', () => {
    render(<Button type="submit">Lưu</Button>)

    expect(screen.getByRole('button', { name: 'Lưu' })).toHaveAttribute('type', 'submit')
  })
})
