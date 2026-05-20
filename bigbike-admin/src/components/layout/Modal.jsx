import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  wide = false,
  closeLabel = 'Đóng',
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.() }}>
      <DialogContent
        showClose={false}
        aria-describedby={undefined}
        className={cn('p-0 flex flex-col max-h-[90vh]', wide ? 'max-w-3xl' : 'max-w-lg')}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold font-body text-foreground leading-snug">
            {title}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel} className="shrink-0">
            <X size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {actions ? (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
            {actions}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
