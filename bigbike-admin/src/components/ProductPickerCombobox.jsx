import { useEffect, useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { DropdownPopover } from './DropdownPopover'
import { cn } from '@/lib/utils'
import { resolveDisplayUrl } from '@/lib/contracts'

/**
 * Ô tìm kiếm + dropdown chọn sản phẩm dùng chung (related / featured / home).
 *
 * Bọc {@link DropdownPopover} (Radix Popover) nên dropdown tự lật lên trên,
 * chừa mép màn hình và co chiều cao theo chỗ trống — thay cho dropdown
 * `absolute` tự viết vốn bị kẹt sát đáy viewport.
 *
 * @param {boolean} open - mở khi đang có truy vấn / focus tuỳ call site quyết định.
 * @param {(next:boolean)=>void} [onOpenChange] - cho Radix đóng khi click ngoài / Esc.
 * @param {(v:string)=>void} onSearchChange
 * @param {()=>void} [onFocus]
 * @param {Array} items - kết quả tìm kiếm.
 * @param {Array} [addedIds] - id đã thêm → hiển thị mờ + nhãn addedText.
 * @param {(product:any)=>void} onPick
 */
export function ProductPickerCombobox({
  search,
  onSearchChange,
  open,
  onOpenChange,
  onFocus,
  loading,
  items = [],
  addedIds = [],
  onPick,
  placeholder,
  loadingText,
  emptyText,
  addedText,
  disabled,
}) {
  // Điều hướng bàn phím theo mẫu combobox/listbox: focus ở ô nhập, option được đánh dấu qua
  // aria-activedescendant thay vì tự nhận focus. -1 = chưa đánh dấu option nào.
  const [activeIndex, setActiveIndex] = useState(-1)
  const listboxId = useId()
  const optionId = (i) => `${listboxId}-opt-${i}`
  // Đổi kết quả tìm kiếm ⇒ reset đánh dấu để không trỏ nhầm.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(-1)
  }, [items])

  function onKeyDown(e) {
    if (!open || !items.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      const product = items[activeIndex]
      if (product && !addedIds.includes(product.id)) { e.preventDefault(); onPick(product) }
    }
  }

  return (
    <DropdownPopover
      open={open}
      onOpenChange={onOpenChange}
      anchor={
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={Boolean(open)}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        />
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground px-3 py-2" role="status">{loadingText}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground px-3 py-2">{emptyText}</p>
      ) : (
        <ul id={listboxId} role="listbox" className="list-none">
          {items.map((product, i) => {
            const already = addedIds.includes(product.id)
            const imgUrl = resolveDisplayUrl(product.image?.url)
            return (
              <li
                key={product.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                aria-disabled={already || undefined}
                onClick={() => { if (!already) onPick(product) }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2 text-left text-sm',
                  already ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted',
                  i === activeIndex && !already && 'bg-muted',
                )}
              >
                {imgUrl && (
                  <img
                    src={imgUrl}
                    alt={product.image?.alt || product.name || ''}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="w-8 h-8 object-cover shrink-0 rounded-sm"
                  />
                )}
                <span className="flex-1 min-w-0 truncate">{product.name}</span>
                {already && addedText && (
                  <span className="text-xs text-muted-foreground shrink-0">{addedText}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </DropdownPopover>
  )
}
