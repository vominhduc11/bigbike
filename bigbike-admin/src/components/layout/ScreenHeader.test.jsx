import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'
import { ScreenHeader } from './ScreenHeader'

const originalMatchMedia = window.matchMedia

function useMobileViewport() {
  window.matchMedia = vi.fn(() => ({
    matches: true,
    media: '(max-width: 639px)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('ScreenHeader responsive actions', () => {
  it('gom nhiều thao tác vào một nút trên điện thoại', async () => {
    useMobileViewport()
    const user = userEvent.setup()
    render(
      <ScreenHeader
        title="Sản phẩm"
        actions={(
          <div className="flex gap-2">
            <input type="file" className="hidden" aria-label="Tệp nhập" />
            <Button>Nhập</Button>
            <Button>Thêm sản phẩm</Button>
          </div>
        )}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Nhập' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /common\.moreActions|Thêm thao tác|More actions/ }))
    expect(screen.getByRole('button', { name: 'Nhập' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm sản phẩm' })).toBeInTheDocument()
  })

  it('giữ một thao tác chính hiển thị trực tiếp', () => {
    useMobileViewport()
    render(<ScreenHeader title="Đơn hàng" actions={<Button>Xuất dữ liệu</Button>} />)

    expect(screen.getByRole('button', { name: 'Xuất dữ liệu' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /common\.moreActions|Thêm thao tác|More actions/ })).not.toBeInTheDocument()
  })

  it('không đếm thao tác bị ẩn trong lớp bọc lồng nhau', () => {
    useMobileViewport()
    render(
      <ScreenHeader
        title="Đơn hàng"
        actions={(
          <div className="flex gap-2">
            <div className="hidden">
              <Button>Chỉ desktop</Button>
            </div>
            <Button>Xuất dữ liệu</Button>
          </div>
        )}
      />,
    )

    expect(screen.getByRole('button', { name: 'Xuất dữ liệu' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /common\.moreActions|Thêm thao tác|More actions/ })).not.toBeInTheDocument()
  })
})
