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
export function FilterSearchInput({ value, onChange, placeholder, ariaLabel, autoFocus, className, wrapperClassName }) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--bb-text-muted)]"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className={cn(
          'h-[30px] w-full pl-7 pr-2.5 text-xs shadow-none',
          'rounded-[var(--admin-radius-xs)] border-[var(--bb-border-strong)] bg-[var(--bb-surface)] text-[var(--bb-text)]',
          'focus-visible:border-[var(--bb-primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--bb-primary-muted)] focus-visible:ring-offset-0',
          className
        )}
      />
    </div>
  )
}
