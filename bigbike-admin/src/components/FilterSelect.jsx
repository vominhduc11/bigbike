import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/**
 * Select lọc dùng chung cho filter bar — bọc shadcn/Radix Select, thay cho
 * `<select className="bb-select">` native.
 *
 * Đo khít theo `.bb-filter-bar .bb-select` (cao 30px, chữ 12.5px, bo 6px, token
 * `--bb-*`) để thẳng hàng với ô tìm kiếm `bb-input` cạnh nó — không lệch filter bar.
 *
 * Radix Select cấm `value=""` trên item, nên map chuỗi rỗng sang một sentinel
 * nội bộ; call site vẫn nhận/đưa chuỗi rỗng như native select.
 *
 * @param {string|number} value
 * @param {(v:string)=>void} onValueChange - nhận giá trị thô (đã map sentinel về '').
 * @param {Array<{value:string|number,label:React.ReactNode}>} options
 */
const EMPTY = '__empty__'

const toRadix = (v) => (v === '' || v == null ? EMPTY : String(v))
const fromRadix = (v) => (v === EMPTY ? '' : v)

export function FilterSelect({ value, onValueChange, options = [], placeholder, ariaLabel, className, disabled }) {
  return (
    <Select value={toRadix(value)} onValueChange={(v) => onValueChange(fromRadix(v))} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          'h-[30px] w-auto gap-2 px-2.5 text-[12.5px] shadow-none',
          'rounded-[6px] border-[var(--bb-border-strong)] bg-[var(--bb-surface)] text-[var(--bb-text)]',
          'focus:border-[var(--bb-primary)] focus:ring-[3px] focus:ring-[var(--bb-primary-muted)] focus:ring-offset-0',
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={String(o.value)} value={toRadix(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
