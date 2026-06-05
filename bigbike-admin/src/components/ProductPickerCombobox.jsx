import { Input } from '@/components/ui/input'
import { DropdownPopover } from './DropdownPopover'
import { cn } from '@/lib/utils'

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
  return (
    <DropdownPopover
      open={open}
      onOpenChange={onOpenChange}
      anchor={
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
        />
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground px-3 py-2">{loadingText}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground px-3 py-2">{emptyText}</p>
      ) : (
        items.map((product) => {
          const already = addedIds.includes(product.id)
          return (
            <button
              key={product.id}
              type="button"
              disabled={already}
              onClick={() => onPick(product)}
              className={cn('flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-muted text-sm', already && 'opacity-50 cursor-not-allowed')}
            >
              {product.image?.url && (
                <img
                  src={product.image.url}
                  alt={product.image.alt || product.name || ''}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="w-8 h-8 object-cover shrink-0"
                />
              )}
              <span className="flex-1 min-w-0 truncate">{product.name}</span>
              {already && addedText && (
                <span className="text-xs text-muted-foreground shrink-0">{addedText}</span>
              )}
            </button>
          )
        })
      )}
    </DropdownPopover>
  )
}
