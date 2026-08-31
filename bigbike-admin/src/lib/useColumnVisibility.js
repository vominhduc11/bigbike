import { useCallback, useState } from 'react'

const FIXED_COLUMN_KEYS = new Set([
  'select',
  'selection',
  'drag',
  'reorder',
  'sortOrder',
  'actions',
  'product',
  'category',
  'brand',
  'title',
  'name',
  'orderNumber',
  'customer',
  'review',
  'author',
  'user',
  'email',
  'sourcePattern',
])

function isFixedColumn(column) {
  return column.hideable === false || FIXED_COLUMN_KEYS.has(column.key)
}

// T7 — cho phép admin tự ẩn/hiện cột trên các bảng dữ liệu. `columns` giữ
// nguyên định dạng AdminTable đã dùng ({key,label,...}); trả về đúng mảng đó
// đã lọc theo lựa chọn hiện tại, lưu vào localStorage theo `storageKey`.
export function useColumnVisibility(columns, storageKey) {
  const [hiddenKeys, setHiddenKeys] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      const saved = raw ? JSON.parse(raw) : []
      return Array.isArray(saved) ? saved : []
    } catch {
      return []
    }
  })

  const toggle = useCallback(
    (key) => {
      if (columns.some((column) => column.key === key && isFixedColumn(column))) return
      setHiddenKeys((previous) => {
        const next = previous.includes(key) ? previous.filter((k) => k !== key) : [...previous, key]
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // localStorage không khả dụng (private mode...) — bỏ qua, chỉ mất persist.
        }
        return next
      })
    },
    [columns, storageKey],
  )

  const visibleColumns = columns.filter(
    (column) => isFixedColumn(column) || !hiddenKeys.includes(column.key),
  )

  return {
    visibleColumns,
    hiddenKeys,
    toggle,
    allColumns: columns.filter((column) => !isFixedColumn(column)),
  }
}
