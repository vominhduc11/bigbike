import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Wrapper dropdown/combobox dùng chung — bọc Radix Popover (Floating UI).
 *
 * Thay cho dropdown `absolute` tự viết (luôn xổ xuống, max-h cố định) vốn bị
 * ép sát / tràn mép màn hình khi ô neo nằm gần đáy viewport.
 *
 * Tự xử lý va chạm viewport:
 * - `avoidCollisions` (mặc định) → lật lên trên khi không đủ chỗ phía dưới.
 * - `collisionPadding` → luôn chừa khoảng cách an toàn tới mép màn hình.
 * - `--radix-popover-content-available-height` → cao tối đa đúng bằng chỗ trống.
 * - `--radix-popover-trigger-width` → rộng đúng bằng phần tử neo.
 *
 * @param {boolean} open - dropdown có đang mở không.
 * @param {(next:boolean)=>void} [onOpenChange] - báo khi Radix muốn đóng (click ngoài / Esc).
 * @param {React.ReactNode} anchor - phần tử neo (Input / hộp tag…), phải nhận ref → dùng asChild.
 * @param {React.ReactNode} children - nội dung danh sách bên trong dropdown.
 */
export function DropdownPopover({ open, onOpenChange, anchor, children, className }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange ?? (() => {})}>
      <div className="relative">
        <PopoverAnchor asChild>{anchor}</PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={4}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className={cn('p-0 overflow-y-auto', className)}
          style={{
            width: 'var(--radix-popover-trigger-width)',
            maxHeight: 'var(--radix-popover-content-available-height)',
          }}
        >
          {children}
        </PopoverContent>
      </div>
    </Popover>
  )
}
