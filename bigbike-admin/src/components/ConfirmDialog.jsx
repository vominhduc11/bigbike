import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setConfirmHandler } from '../lib/confirm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export function ConfirmDialogProvider() {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState(null)
  const resolveRef = useRef(null)

  useEffect(() => {
    setConfirmHandler(
      (message, title = t('common.confirm'), options = {}) =>
        new Promise((resolve) => {
          resolveRef.current = resolve
          setDialog({
            message,
            title,
            // Keep the shared dialog neutral by default. Permanent destructive
            // actions must opt in explicitly so colour communicates risk.
            variant: options?.variant === 'danger' ? 'danger' : 'default',
            confirmLabel: options?.confirmLabel || t('common.confirm'),
            cancelLabel: options?.cancelLabel || t('common.cancel'),
          })
        }),
    )
    return () => setConfirmHandler(null)
  }, [t])

  const handleClose = useCallback((result) => {
    setDialog(null)
    resolveRef.current?.(result)
  }, [])

  return (
    <Dialog
      open={!!dialog}
      onOpenChange={(o) => {
        if (!o) handleClose(false)
      }}
    >
      <DialogContent showClose={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{dialog?.title}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="px-6 pb-2 text-sm whitespace-pre-line">
          {dialog?.message}
        </DialogDescription>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => handleClose(false)}
            autoFocus={dialog?.variant === 'danger'}
          >
            {dialog?.cancelLabel}
          </Button>
          <Button
            variant={dialog?.variant}
            onClick={() => handleClose(true)}
            autoFocus={dialog?.variant !== 'danger'}
          >
            {dialog?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
