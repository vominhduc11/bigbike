import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setConfirmHandler } from '../lib/confirm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export function ConfirmDialogProvider() {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState(null)
  const resolveRef = useRef(null)

  useEffect(() => {
    setConfirmHandler((message, title = t('common.confirm')) =>
      new Promise((resolve) => {
        resolveRef.current = resolve
        setDialog({ message, title })
      })
    )
    return () => setConfirmHandler(null)
  }, [t])

  const handleClose = useCallback((result) => {
    setDialog(null)
    resolveRef.current?.(result)
  }, [])

  return (
    <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) handleClose(false) }}>
      <DialogContent showClose={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{dialog?.title}</DialogTitle>
        </DialogHeader>
        <p className="px-6 pb-2 text-sm text-muted-foreground">{dialog?.message}</p>
        <DialogFooter>
          <Button variant="secondary" onClick={() => handleClose(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={() => handleClose(true)} autoFocus>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
