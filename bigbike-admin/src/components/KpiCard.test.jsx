import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { KpiCard } from './KpiCard'

describe('KpiCard', () => {
  it('renders the shared KPI variants and activates by click or keyboard', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <KpiCard
        label="Doanh thu hôm nay"
        value="1.590.000 ₫"
        icon={<span aria-hidden="true">$</span>}
        tone="brand"
        money
        active
        clickable
        ariaLabel="Mở báo cáo doanh thu hôm nay"
        onClick={onClick}
        detail="Tăng 12%"
      />,
    )

    const card = screen.getByRole('button', { name: 'Mở báo cáo doanh thu hôm nay' })
    expect(card).toHaveClass('bb-kpi', 'clickable', 'active')
    expect(screen.getByText('1.590.000 ₫')).toHaveClass('bb-kpi-value--money')
    expect(screen.getByText('Tăng 12%')).toBeInTheDocument()

    await user.click(card)
    card.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(3)
  })
})
