import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { MobileCardList, MobileCard } from '@/components/layout/MobileCardList'
import { cn } from '@/lib/utils'

const ALIGN_CLASS = { right: 'text-right', center: 'text-center', left: 'text-left' }

// Dòng có role="button" + onClick/onKeyDown để mở chi tiết. Khi thao tác phát ra từ một control
// tương tác con (checkbox chọn dòng, link cột đầu, nút/select trong cột action), Enter/Space/click
// KHÔNG được vừa chạy control con vừa mở chi tiết. Guard: bỏ qua nếu control tương tác gần nhất
// không phải chính dòng (currentTarget).
const ROW_INTERACTIVE_SELECTOR =
  'button,a,input,select,textarea,label,[role="checkbox"],[role="button"],[role="menuitem"]'
function fromInteractiveChild(e) {
  const el = e.target.closest(ROW_INTERACTIVE_SELECTOR)
  return el && el !== e.currentTarget
}

/**
 * AdminTable — shared data table.
 *
 * `mobileCard` (optional): `(row) => ({ title, subtitle, status, meta, actions, onClick, selectionLabel })`.
 * When provided, narrow screens (<640px) render the rows as cards via
 * MobileCardList instead of a horizontally-scrolling table. When omitted,
 * the table renders exactly as before — existing screens are unaffected.
 *
 * `rowHref` (optional): `(row) => string`. Khi cung cấp, ô cột đầu (cột định danh)
 * trở thành <a> link thật và cả dòng hỗ trợ Ctrl/Cmd-click + chuột-giữa để mở tab
 * mới (hành vi trình duyệt). Click trái thường vẫn gọi onRowClick (cùng tab).
 */
export function AdminTable({
  columns,
  rows,
  caption,
  loading = false,
  pageSize = 8,
  onSortChange,
  sortKey,
  sortDir,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
  rowClassName,
  mobileCard,
  rowHref,
}) {
  const { t } = useTranslation()
  const hrefOf = (row) => (typeof rowHref === 'function' ? rowHref(row) : undefined)
  const openTab = (href) => {
    if (href) window.open(href, '_blank', 'noopener')
  }
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
    <Table containerClassName="max-h-[calc(100vh-13rem)]">
      {caption ? (
        <caption className="mb-2 text-sm text-muted-foreground text-left">{caption}</caption>
      ) : null}
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {selectable && (
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label={t('common.selectAll', { defaultValue: 'Chọn tất cả' })}
              />
            </TableHead>
          )}
          {columns.map((column) => {
            const isSorted = sortKey === column.key
            const canSort = !!(onSortChange && column.sortable)
            return (
              <TableHead
                key={column.key}
                className={cn(ALIGN_CLASS[column.align], isSorted && 'text-foreground')}
                aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {canSort ? (
                  // Nút bấm thật bên trong <th scope="col"> — giữ ngữ nghĩa columnheader
                  // (không đè role="button" lên <th>), vẫn focus/Enter/Space chuẩn của button.
                  <Button
                    variant="unstyled"
                    onClick={() => handleSort(column)}
                    aria-label={t('common.sortColumn', { defaultValue: 'Sắp xếp cột' })}
                    className="inline-flex cursor-pointer select-none items-center gap-1 rounded-xs focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
                  >
                    {column.label}
                    <span aria-hidden="true" className="opacity-60">
                      {isSorted ? (
                        sortDir === 'asc' ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )
                      ) : (
                        <ChevronsUpDown size={12} />
                      )}
                    </span>
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1">{column.label}</span>
                )}
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: pageSize }, (_, i) => (
              <TableRow key={i} className="h-12 hover:bg-transparent animate-pulse">
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
              const extraClass =
                typeof rowClassName === 'function' ? rowClassName(row) : rowClassName
              const clickable = typeof onRowClick === 'function'
              const href = hrefOf(row)
              const rowClickable = clickable || !!href
              return (
                <TableRow
                  key={row.id}
                  className={cn('h-12', extraClass, rowClickable && 'cursor-pointer')}
                  onClick={
                    rowClickable
                      ? (e) => {
                          if (fromInteractiveChild(e)) return
                          // Ctrl/Cmd/Shift-click → mở tab mới; còn lại điều hướng cùng tab.
                          if (href && (e.metaKey || e.ctrlKey || e.shiftKey)) {
                            e.preventDefault()
                            openTab(href)
                            return
                          }
                          if (clickable) onRowClick(row)
                        }
                      : undefined
                  }
                  onAuxClick={
                    href
                      ? (e) => {
                          if (e.button === 1) {
                            e.preventDefault()
                            openTab(href)
                          }
                        }
                      : undefined
                  }
                  tabIndex={rowClickable ? 0 : undefined}
                  onKeyDown={
                    rowClickable
                      ? (e) => {
                          if (fromInteractiveChild(e)) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            if (clickable) onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  role={rowClickable ? 'button' : undefined}
                >
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onCheckedChange={() => toggleOne(row.id)}
                        aria-label={t('common.selectRow', { defaultValue: 'Chọn hàng' })}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                  )}
                  {columns.map((column, colIdx) => {
                    const content = column.render ? column.render(row) : (row[column.key] ?? '—')
                    // Bọc ô định danh (cột đầu) bằng link thật: chuột-phải "Mở ở tab mới",
                    // Ctrl/Cmd-click, chuột-giữa đều hoạt động theo trình duyệt.
                    const cell =
                      href && colIdx === 0 ? (
                        <a
                          href={href}
                          className="bb-row-link"
                          title={t('common.openInNewTab')}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
                            e.preventDefault()
                            if (clickable) onRowClick(row)
                          }}
                        >
                          {content}
                        </a>
                      ) : (
                        content
                      )
                    return (
                      <TableCell
                        key={`${row.id}:${column.key}`}
                        className={ALIGN_CLASS[column.align]}
                      >
                        {cell}
                      </TableCell>
                    )
                  })}
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
                  selectable={selectable}
                  selected={selectedIds.includes(row.id)}
                  onSelectChange={() => toggleOne(row.id)}
                  selectionLabel={
                    card.selectionLabel ||
                    t('common.selectNamedRow', {
                      name: typeof card.title === 'string' ? card.title : row.id,
                    })
                  }
                />
              )
            })}
      </MobileCardList>
    </>
  )
}
