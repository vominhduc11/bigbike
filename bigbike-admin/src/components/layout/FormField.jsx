import { Label } from '@/components/ui/label'

export function FormField({ label, required, helper, error, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <Label htmlFor={htmlFor} className="flex items-center gap-0.5">
          {label}
          {required ? <span className="text-danger ml-0.5" aria-hidden="true">*</span> : null}
        </Label>
      ) : null}
      {children}
      {helper && !error ? (
        <span className="text-xs text-muted-foreground">{helper}</span>
      ) : null}
      {error ? (
        <span className="text-xs text-danger" role="alert">{error}</span>
      ) : null}
    </div>
  )
}
