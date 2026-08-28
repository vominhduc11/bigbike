import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/input'
import { ResponsiveFilterBar } from './ResponsiveFilterBar'

const originalMatchMedia = window.matchMedia

function mockViewport(matches) {
  window.matchMedia = vi.fn(() => ({
    matches,
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

describe('ResponsiveFilterBar', () => {
  it('chỉ dựng một cây điều khiển trong drawer trên điện thoại', async () => {
    mockViewport(true)
    const user = userEvent.setup()
    render(
      <ResponsiveFilterBar ariaLabel="Bộ lọc đơn hàng" activeFilterCount={2}>
        <Input aria-label="Tìm đơn" />
      </ResponsiveFilterBar>,
    )

    expect(screen.queryByRole('textbox', { name: 'Tìm đơn' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /common\.filters|Bộ lọc|Filters/ }))
    expect(screen.getByRole('textbox', { name: 'Tìm đơn' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox', { name: 'Tìm đơn' })).toHaveLength(1)
  })

  it('hiện thanh lọc trực tiếp trên màn hình rộng', () => {
    mockViewport(false)
    render(
      <ResponsiveFilterBar ariaLabel="Bộ lọc đơn hàng">
        <Input aria-label="Tìm đơn" />
      </ResponsiveFilterBar>,
    )

    expect(screen.getByRole('region', { name: 'Bộ lọc đơn hàng' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Tìm đơn' })).toBeInTheDocument()
  })
})
