import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminTable } from './AdminTable'
import { TableCell, TableRow } from '@/components/ui/table'

const rows = [{ id: 'row-1', name: 'Bản ghi một' }]

describe('AdminTable', () => {
  beforeEach(() => window.localStorage.clear())

  it('cho phép bảng kéo-thả dùng hàng tùy biến nhưng vẫn giữ khung bảng dùng chung', () => {
    render(
      <AdminTable
        columns={[{ key: 'name', label: 'Tên' }]}
        rows={rows}
        renderRow={(row) => (
          <TableRow key={row.id} data-testid="custom-row">
            <TableCell>{row.name}</TableCell>
          </TableRow>
        )}
      />,
    )

    expect(screen.getByTestId('custom-row')).toHaveTextContent('Bản ghi một')
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('giữ quyền chọn riêng của từng thẻ mobile', async () => {
    const user = userEvent.setup()
    const onSelectChange = vi.fn()
    render(
      <AdminTable
        columns={[{ key: 'name', label: 'Tên' }]}
        rows={rows}
        mobileCard={(row) => ({
          title: row.name,
          selectable: true,
          selected: false,
          onSelectChange,
          selectionLabel: `Chọn ${row.name}`,
        })}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Chọn Bản ghi một' }))
    expect(onSelectChange).toHaveBeenCalledWith(true)
  })

  it('chuyển yêu cầu sắp xếp qua callback của màn cha', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(
      <AdminTable
        columns={[{ key: 'name', label: 'Tên', sortable: true }]}
        rows={rows}
        onSortChange={onSortChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Sắp xếp cột' }))
    expect(onSortChange).toHaveBeenCalledWith('name', 'asc')
  })

  it('applies shared column sizing to both the header and data cells', () => {
    render(
      <AdminTable
        columns={[{ key: 'name', label: 'Tên', headerClassName: 'min-w-60', cellClassName: 'min-w-60' }]}
        rows={rows}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Tên' })).toHaveClass('min-w-60')
    expect(screen.getByRole('cell', { name: 'Bản ghi một' })).toHaveClass('min-w-60')
  })

  it('nhớ mật độ riêng của màn hình sau khi người dùng đổi', async () => {
    const user = userEvent.setup()
    render(
      <AdminTable
        caption="Danh sách"
        columns={[{ key: 'name', label: 'Tên' }]}
        rows={rows}
        densityKey="products"
        defaultDensity="spacious"
      />,
    )

    await user.click(screen.getByRole('button', { name: /common\.tableDensity\.spacious|Thoáng|Spacious/ }))
    await user.click(screen.getByRole('menuitemradio', { name: /common\.tableDensity\.compact|Gọn|Compact/ }))

    expect(window.localStorage.getItem('bigbike-admin:table-density:products')).toBe('compact')
    expect(screen.getByRole('button', { name: /common\.tableDensity\.compact|Gọn|Compact/ })).toBeInTheDocument()
  })
})
