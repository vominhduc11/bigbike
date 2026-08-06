import { cloneElement, isValidElement, useId } from 'react'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * FormField — shared labelled form control dùng chung toàn admin.
 * Tự liên kết label↔control (htmlFor/id) và gắn aria-invalid/aria-required/aria-describedby
 * vào control con, để trạng thái lỗi/bắt buộc không chỉ dựa vào màu (control nhận viền đỏ
 * qua aria-invalid, kèm icon ở dòng lỗi). `full` trải field ra 2 cột grid; `count`/`countWarn`
 * hiện bộ đếm ký tự đối diện nhãn (dùng cho field có giới hạn độ dài).
 *
 * `warning` là cảnh báo MỀM: giá trị hợp lệ, vẫn lưu được, chỉ nhắc admin xem lại — khác `error`
 * (chặn lưu, viền đỏ, aria-invalid). Thứ tự ưu tiên hiển thị: error > warning > helper.
 */
export function FormField({ label, required, helper, error, warning, htmlFor, count, countWarn, full, children }) {
  const autoId = useId()
  // Nếu control con tự đặt id, ưu tiên id đó để htmlFor của Label khớp đúng control
  // (tránh Label trỏ vào autoId trong khi control mang id riêng).
  const childId = isValidElement(children) ? children.props.id : undefined
  const fieldId = htmlFor || childId || autoId
  const errorId = `${fieldId}-error`
  const warningId = `${fieldId}-warning`
  const helperId = `${fieldId}-helper`
  const describedBy = error ? errorId : warning ? warningId : helper ? helperId : undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || fieldId,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        'aria-required': required ? true : children.props['aria-required'],
        'aria-describedby': cn(children.props['aria-describedby'], describedBy) || undefined,
      })
    : children

  return (
    <div className={cn('flex flex-col gap-1.5', full && 'md:col-span-2')}>
      {label || count != null ? (
        <div className="flex items-center justify-between">
          {label ? (
            <Label htmlFor={fieldId} className="flex items-center gap-0.5">
              {label}
              {required ? <span className="text-danger ml-0.5" aria-hidden="true">*</span> : null}
            </Label>
          ) : null}
          {count != null ? (
            <span className={cn('text-xs tabular-nums text-muted-foreground', countWarn && 'text-[var(--admin-color-status-warning-text)] font-semibold')}>
              {count}
            </span>
          ) : null}
        </div>
      ) : null}
      {control}
      {helper && !error && !warning ? (
        <span id={helperId} className="text-xs text-muted-foreground">{helper}</span>
      ) : null}
      {warning && !error ? (
        <span
          id={warningId}
          className="flex items-center gap-1 text-xs text-[var(--admin-color-status-warning-text)] font-semibold"
          role="status"
        >
          <AlertTriangle size={13} aria-hidden="true" className="shrink-0" />
          {warning}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="flex items-center gap-1 text-xs text-danger font-semibold" role="alert">
          <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
          {error}
        </span>
      ) : null}
    </div>
  )
}
