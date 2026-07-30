import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileFilterDrawer } from './MobileFilterDrawer'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => values.defaultValue || key,
  }),
}))

const query = {
  actorType: 'ALL',
  resourceType: 'ALL',
  q: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 20,
}

function renderDrawer(overrides = {}) {
  const props = {
    query,
    searchInput: '',
    activeFilterCount: 0,
    onApply: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn(),
    isFiltered: false,
    ...overrides,
  }
  render(<MobileFilterDrawer {...props} />)
  return props
}

describe('bộ lọc mobile của nhật ký', () => {
  it('gom thay đổi và chỉ áp dụng một lần khi xác nhận', async () => {
    const user = userEvent.setup()
    const props = renderDrawer()

    await user.type(
      screen.getByPlaceholderText('auditLog.filterSearchPlaceholder'),
      'đơn 7416',
    )
    await user.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }))

    expect(props.onApply).toHaveBeenCalledTimes(1)
    expect(props.onApply).toHaveBeenCalledWith(expect.objectContaining({
      q: 'đơn 7416',
      actorType: 'ALL',
      resourceType: 'ALL',
      pageSize: 20,
    }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('chặn áp dụng và chỉ rõ lỗi khi khoảng ngày không hợp lệ', () => {
    renderDrawer()

    fireEvent.change(screen.getByLabelText('auditLog.filterFrom'), {
      target: { value: '2026-07-30' },
    })
    fireEvent.change(screen.getByLabelText('auditLog.filterTo'), {
      target: { value: '2026-07-01' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
    )
    expect(screen.getByRole('button', { name: 'Áp dụng bộ lọc' })).toBeDisabled()
  })

  it('hiện nút xoá tất cả khi đang có bộ lọc', async () => {
    const user = userEvent.setup()
    const props = renderDrawer({ isFiltered: true, activeFilterCount: 2 })

    await user.click(screen.getByRole('button', { name: 'auditLog.mobileFilterResetAll' }))

    expect(props.onReset).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
