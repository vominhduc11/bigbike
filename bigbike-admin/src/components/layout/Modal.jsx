import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  wide = false,
  closeLabel,
  contentClassName,
}) {
  const { t } = useTranslation()
  const label = closeLabel || t('common.close')
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.() }}>
      <DialogContent
        showClose={false}
        aria-describedby={undefined}
        className={cn('p-0 flex flex-col max-h-[90vh]', contentClassName || (wide ? 'max-w-3xl' : 'max-w-lg'))}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold font-body text-foreground leading-snug">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {description}
              </DialogDescription>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={label} className="shrink-0">
            <X size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {actions ? (
          <div className="flex flex-wrap justify-end gap-2 px-5 py-3 border-t border-border shrink-0 max-sm:flex-col max-sm:[&>button]:w-full">
            {actions}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
