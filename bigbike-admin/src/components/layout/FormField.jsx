import { cloneElement, isValidElement, useId } from 'react'
import { AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * FormField — shared labelled form control.
 * Tự liên kết label↔control (htmlFor/id) và gắn aria-invalid + aria-describedby
 * vào control con khi có lỗi, để screen reader đọc được lỗi và lỗi không chỉ dựa
 * vào màu (control nhận viền đỏ qua aria-invalid, kèm icon ở dòng lỗi).
 */
export function FormField({ label, required, helper, error, htmlFor, children }) {
  const autoId = useId()
  const fieldId = htmlFor || autoId
  const errorId = `${fieldId}-error`
  const helperId = `${fieldId}-helper`
  const describedBy = error ? errorId : helper ? helperId : undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || fieldId,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        'aria-required': required ? true : children.props['aria-required'],
        'aria-describedby': cn(children.props['aria-describedby'], describedBy) || undefined,
      })
    : children

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <Label htmlFor={fieldId} className="flex items-center gap-0.5">
          {label}
          {required ? <span className="text-danger ml-0.5" aria-hidden="true">*</span> : null}
        </Label>
      ) : null}
      {control}
      {helper && !error ? (
        <span id={helperId} className="text-xs text-muted-foreground">{helper}</span>
      ) : null}
      {error ? (
        <span id={errorId} className="flex items-center gap-1 text-xs text-danger" role="alert">
          <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
          {error}
        </span>
      ) : null}
    </div>
  )
}
