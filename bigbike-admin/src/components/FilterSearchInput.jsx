import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Ô tìm kiếm filter bar dùng chung — icon kính lúp + shadcn Input, thay cho
 * ô tìm kiếm native tự dựng riêng ở từng màn.
 *
 * Đo khít theo {@link FilterSelect} để search và select cùng chiều cao, cùng style.
 *
 * @param {string} value
 * @param {(v:string)=>void} onChange - nhận giá trị thô (đã rút từ e.target.value).
 */
export function FilterSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus,
  className,
  wrapperClassName,
  disabled,
}) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className={cn(
          'h-9 max-sm:h-11 w-full pl-9 pr-3 text-sm shadow-none',
          'rounded-[var(--admin-radius-control)] border-border bg-background text-foreground',
          'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          className,
        )}
      />
    </div>
  )
}
