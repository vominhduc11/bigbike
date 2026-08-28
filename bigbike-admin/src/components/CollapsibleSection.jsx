import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HelpTooltip } from '@/components/HelpTooltip'

// Nhóm thu gọn dùng chung cho các form dài (Danh mục, Thương hiệu, Bài viết...).
// Chống ngợp field: giữ mở phần bắt buộc, gom phần tùy chọn/nâng cao vào đây, đóng
// sẵn. Giao diện dùng trực tiếp token Tailwind của admin. Controlled qua
// `open`/`onToggle`. `hint` hiện chú thích ngắn cạnh
// tiêu đề; `badge` là slot tuỳ chọn bên phải (vd đếm số mục).
//
// `keepMounted`: khi true, children luôn render nhưng ẩn qua thuộc tính `hidden` lúc
// đóng — dùng cho section chứa editor có state cục bộ hoặc field có validation, để
// KHÔNG mất state/không giấu lỗi khi đóng. Mặc định false (unmount khi đóng cho nhẹ).
export function CollapsibleSection({ title, hint, help, open, onToggle, badge, keepMounted = false, className, bodyClassName, children }) {
  const panelId = useId()
  const longHint = typeof hint === 'string' && Array.from(hint.trim()).length > 80
  const helpContent = help || (longHint ? hint : undefined)
  let body = null
  if (keepMounted) {
    body = <div id={panelId} className={cn('flex flex-col gap-5', bodyClassName)} hidden={!open}>{children}</div>
  } else if (open) {
    body = <div id={panelId} className={cn('flex flex-col gap-5', bodyClassName)}>{children}</div>
  }
  return (
    <section className={cn('flex flex-col gap-4', helpContent && 'relative', className)}>
      <Button
        variant="unstyled"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'w-full justify-start rounded-[var(--admin-radius-card)] border border-border bg-background px-4 py-3 text-left shadow-xs hover:border-[var(--admin-color-border-strong)] hover:bg-muted',
          helpContent && 'pr-14',
        )}
      >
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
        />
        <span className="text-sm font-extrabold uppercase tracking-wide text-foreground">{title}</span>
        {hint && !longHint ? <span className="text-xs font-medium leading-snug text-muted-foreground">· {hint}</span> : null}
        {badge}
      </Button>
      {helpContent ? <HelpTooltip content={helpContent} className="absolute right-3 top-2" /> : null}
      {body}
    </section>
  )
}
