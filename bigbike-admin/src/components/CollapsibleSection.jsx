import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Nhóm thu gọn dùng chung cho các form dài (Danh mục, Thương hiệu, Bài viết...).
// Chống ngợp field: giữ mở phần bắt buộc, gom phần tùy chọn/nâng cao vào đây, đóng
// sẵn. Tái dùng hệ CSS `bb-section-group` (admin-prototype.css) đã có sẵn — không
// tạo class mới. Controlled qua `open`/`onToggle`. `hint` hiện chú thích ngắn cạnh
// tiêu đề; `badge` là slot tuỳ chọn bên phải (vd đếm số mục).
//
// `keepMounted`: khi true, children luôn render nhưng ẩn qua thuộc tính `hidden` lúc
// đóng — dùng cho section chứa editor có state cục bộ hoặc field có validation, để
// KHÔNG mất state/không giấu lỗi khi đóng. Mặc định false (unmount khi đóng cho nhẹ).
export function CollapsibleSection({ title, hint, open, onToggle, badge, keepMounted = false, className, bodyClassName, children }) {
  const panelId = useId()
  let body = null
  if (keepMounted) {
    body = <div id={panelId} className={cn('bb-section-group-body', bodyClassName)} hidden={!open}>{children}</div>
  } else if (open) {
    body = <div id={panelId} className={cn('bb-section-group-body', bodyClassName)}>{children}</div>
  }
  return (
    <section className={cn('bb-section-group', className)}>
      <Button
        variant="unstyled"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="bb-section-group-toggle"
      >
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
        />
        <span className="bb-section-group-title">{title}</span>
        {hint && <span className="bb-section-group-hint">· {hint}</span>}
        {badge}
      </Button>
      {body}
    </section>
  )
}
