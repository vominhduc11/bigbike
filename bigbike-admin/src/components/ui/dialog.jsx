import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-[var(--admin-z-overlay)] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
}

export function DialogContent({ className, children, showClose = true, ...props }) {
  const { t } = useTranslation()
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-[var(--admin-z-modal)] w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 bg-card border border-border shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-[var(--admin-radius-card)]',
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius-control)] opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">{t('common.close')}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn('flex flex-col gap-2 p-6 pb-4', className)}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 p-6 pt-4 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      className={cn('text-base font-semibold font-body text-foreground leading-none', className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}
