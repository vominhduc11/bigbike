import { useCallback, useState } from 'react'

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
    [storageKey],
  )

  const visibleColumns = columns.filter((c) => !hiddenKeys.includes(c.key))

  return { visibleColumns, hiddenKeys, toggle, allColumns: columns }
}
