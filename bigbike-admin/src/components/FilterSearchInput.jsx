import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Ô tìm kiếm filter bar dùng chung — icon kính lúp + shadcn Input, thay cho
 * `<input type="search" className="bb-input">` native.
 *
 * Đo khít theo {@link FilterSelect} (cao 30px, chữ 12.5px, bo 6px, token `--bb-*`)
 * để cả filter bar đồng bộ một hệ — search và select cùng chiều cao, cùng style.
 *
 * @param {string} value
 * @param {(v:string)=>void} onChange - nhận giá trị thô (đã rút từ e.target.value).
 */
export function FilterSearchInput({ value, onChange, placeholder, ariaLabel, autoFocus, className, wrapperClassName, disabled }) {
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
          'h-9 w-full pl-9 pr-3 text-sm shadow-none',
          'rounded-sm border-border bg-background text-foreground',
          'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          className
        )}
      />
    </div>
  )
}
