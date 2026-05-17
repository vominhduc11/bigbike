import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const ALIGN_CLASS = { right: 'text-right', center: 'text-center', left: 'text-left' }

export function AdminTable({
  columns, rows, caption,
  loading = false, pageSize = 8,
  onSortChange, sortKey, sortDir,
  selectable = false, selectedIds = [], onSelectionChange,
  onRowClick, rowClassName,
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
    <Table>
      {caption ? <caption className="mb-2 text-sm text-muted-foreground text-left">{caption}</caption> : null}
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {selectable && (
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Chọn tất cả"
              />
            </TableHead>
          )}
          {columns.map((column) => {
            const isSorted = sortKey === column.key
            const canSort = !!(onSortChange && column.sortable)
            return (
              <TableHead
                key={column.key}
                className={cn(
                  ALIGN_CLASS[column.align],
                  canSort && 'cursor-pointer select-none',
                  isSorted && 'text-foreground',
                )}
                onClick={canSort ? () => handleSort(column) : undefined}
                aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {column.label}
                  {canSort && (
                    <span aria-hidden="true" className="opacity-60">
                      {isSorted
                        ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        : <ChevronsUpDown size={12} />}
                    </span>
                  )}
                </span>
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: pageSize }, (_, i) => (
              <TableRow key={i} className="hover:bg-transparent animate-pulse">
                {selectable && (
                  <TableCell>
                    <div className="h-4 w-4 rounded-xs bg-surface-muted" />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key} className={ALIGN_CLASS[column.align]}>
                    <div
                      className="h-4 rounded-xs bg-surface-muted"
                      style={{ width: column.skeletonWidth ?? '70%' }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : rows.map((row) => {
              const extraClass = typeof rowClassName === 'function' ? rowClassName(row) : rowClassName
              const clickable = typeof onRowClick === 'function'
              return (
                <TableRow
                  key={row.id}
                  className={cn(extraClass, clickable && 'cursor-pointer')}
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row) } } : undefined}
                  role={clickable ? 'button' : undefined}
                >
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onCheckedChange={() => toggleOne(row.id)}
                        aria-label="Chọn hàng"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={`${row.id}:${column.key}`}
                      className={ALIGN_CLASS[column.align]}
                    >
                      {column.render ? column.render(row) : (row[column.key] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
      </TableBody>
    </Table>
  )
}
