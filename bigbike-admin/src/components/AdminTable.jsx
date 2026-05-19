import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { MobileCardList, MobileCard } from '@/components/layout/MobileCardList'
import { cn } from '@/lib/utils'

const ALIGN_CLASS = { right: 'text-right', center: 'text-center', left: 'text-left' }

/**
 * AdminTable — shared data table.
 *
 * `mobileCard` (optional): `(row) => ({ title, subtitle, status, meta, actions, onClick })`.
 * When provided, narrow screens (<640px) render the rows as cards via
 * MobileCardList instead of a horizontally-scrolling table. When omitted,
 * the table renders exactly as before — existing screens are unaffected.
 */
export function AdminTable({
  columns, rows, caption,
  loading = false, pageSize = 8,
  onSortChange, sortKey, sortDir,
  selectable = false, selectedIds = [], onSelectionChange,
  onRowClick, rowClassName, mobileCard,
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

  const tableView = (
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

  // No mobile mapping supplied — render the table exactly as before.
  if (typeof mobileCard !== 'function') {
    return tableView
  }

  return (
    <>
      {/* hide-on-mobile only — no extra table chrome, so screens that pass
          mobileCard keep the same desktop look as those that don't. */}
      <div className="hide-on-mobile">{tableView}</div>
      <MobileCardList>
        {loading
          ? Array.from({ length: Math.min(pageSize, 4) }, (_, i) => (
              <div key={i} className="mobile-card animate-pulse">
                <div className="h-4 w-1/2 rounded-xs bg-surface-muted" />
                <div className="h-3 w-3/4 rounded-xs bg-surface-muted" />
              </div>
            ))
          : rows.map((row) => {
              const card = mobileCard(row) || {}
              return (
                <MobileCard
                  key={row.id}
                  title={card.title}
                  subtitle={card.subtitle}
                  status={card.status}
                  meta={card.meta}
                  actions={card.actions}
                  onClick={card.onClick}
                />
              )
            })}
      </MobileCardList>
    </>
  )
}
