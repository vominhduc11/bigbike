import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Nhóm thu gọn dùng chung cho các form dài (Danh mục, Thương hiệu, Bài viết...).
// Chống ngợp field: giữ mở phần bắt buộc, gom phần tùy chọn/nâng cao vào đây, đóng
// sẵn. Tái dùng hệ CSS `bb-section-group` (admin-prototype.css) đã có sẵn — không
// tạo class mới. Controlled qua `open`/`onToggle`. `hint` hiện chú thích ngắn cạnh
// tiêu đề; `badge` là slot tuỳ chọn bên phải (vd đếm số mục). Children KHÔNG render
// khi đóng để form nhẹ.
export function CollapsibleSection({ title, hint, open, onToggle, badge, children }) {
  const panelId = useId()
  return (
    <section className="bb-section-group">
      <button
        type="button"
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
        {hint && <span className="bb-section-group-hint hidden sm:inline">· {hint}</span>}
        {badge}
      </button>
      {open && (
        <div id={panelId} className="bb-section-group-body">
          {children}
        </div>
      )}
    </section>
  )
}
