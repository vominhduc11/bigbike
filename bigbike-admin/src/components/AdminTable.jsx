import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

export function AdminTable({
  columns, rows, caption,
  loading = false, pageSize = 8,
  onSortChange, sortKey, sortDir,
  selectable = false, selectedIds = [], onSelectionChange,
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id))
  const someSelected = !allSelected && rows.some((r) => selectedIds.includes(r.id))

  function toggleAll() {
    if (allSelected) onSelectionChange?.([])
    else onSelectionChange?.(rows.map((r) => r.id))
  }

  function toggleOne(id) {
    if (selectedIds.includes(id)) {
      onSelectionChange?.(selectedIds.filter((x) => x !== id))
    } else {
      onSelectionChange?.([...selectedIds, id])
    }
  }

  function handleSort(col) {
    if (!onSortChange || !col.sortable) return
    if (sortKey === col.key) {
      onSortChange(col.key, sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      onSortChange(col.key, 'asc')
    }
  }

  return (
    <div className="table-wrap">
      <table className="admin-table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="select-col">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleAll}
                  aria-label="Chọn tất cả"
                />
              </th>
            )}
            {columns.map((column) => {
              const isSorted = sortKey === column.key
              const canSort = !!(onSortChange && column.sortable)
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={[
                    column.align ? `align-${column.align}` : undefined,
                    canSort ? 'sortable-col' : undefined,
                    isSorted ? 'sorted-col' : undefined,
                  ].filter(Boolean).join(' ') || undefined}
                  onClick={canSort ? () => handleSort(column) : undefined}
                  aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <span className="col-header-inner">
                    {column.label}
                    {canSort && (
                      <span className="sort-icon" aria-hidden="true">
                        {isSorted
                          ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          : <ChevronsUpDown size={12} />}
                      </span>
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: pageSize }, (_, i) => (
                <tr key={i} className="skeleton-row">
                  {selectable && (
                    <td className="select-col">
                      <div className="skeleton-cell" style={{ width: 16, height: 16, borderRadius: 3 }} />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.key} className={column.align ? `align-${column.align}` : undefined}>
                      <div className="skeleton-cell" style={{ width: column.skeletonWidth ?? '70%' }} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={row.id}>
                  {selectable && (
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label="Chọn hàng"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={`${row.id}:${column.key}`}
                      className={column.align ? `align-${column.align}` : undefined}
                    >
                      {column.render ? column.render(row) : (row[column.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
