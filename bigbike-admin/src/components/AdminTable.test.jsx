import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminTable } from './AdminTable'
import { TableCell, TableRow } from '@/components/ui/table'

const rows = [{ id: 'row-1', name: 'Bản ghi một' }]

describe('AdminTable', () => {
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
})
