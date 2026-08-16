import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileCard } from './MobileCardList'

describe('MobileCard', () => {
  it('gọi đúng tên bản ghi cho ô chọn trên mobile', () => {
    render(
      <MobileCard
        title="Bài viết an toàn"
        selectable
        selectionLabel="Chọn Bài viết an toàn"
        onSelectChange={() => {}}
      />,
    )

    expect(screen.getByRole('checkbox', { name: 'Chọn Bài viết an toàn' })).toBeInTheDocument()
  })

  it('chuyển thay đổi chọn về cho màn cha', async () => {
    const user = userEvent.setup()
    const onSelectChange = vi.fn()
    render(
      <MobileCard
        title="Chuyển hướng cũ"
        selectable
        selectionLabel="Chọn Chuyển hướng cũ"
        onSelectChange={onSelectChange}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Chọn Chuyển hướng cũ' }))
    expect(onSelectChange).toHaveBeenCalledWith(true)
  })

  it('không sập khi màn cha truyền meta sai kiểu', () => {
    render(<MobileCard title="Hội thoại với Trợ lý BigBike" meta="Lượt hỏi: 3 · Lượt gọi AI: 2" />)

    expect(screen.getByText('Hội thoại với Trợ lý BigBike')).toBeInTheDocument()
  })
})
