import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/layout/Modal'
import { PERM_LABEL_KEY_MAP } from './constants'

export function ConfirmSensitiveDialog({ pending, roleName, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const permLabelKey = pending ? PERM_LABEL_KEY_MAP[pending.key] : null
  const permLabel = pending ? (permLabelKey ? t(permLabelKey) : pending.label) : ''
  const msg = pending && (pending.willAdd
    ? t('roles.sensitivePermAdd', { perm: permLabel, role: roleName })
    : t('roles.sensitivePermRemove', { perm: permLabel, role: roleName }))
  return (
    <Modal
      open={!!pending}
      onClose={onCancel}
      title={
        <span className="flex items-center gap-3">
          <AlertTriangle size={20} className="text-warning shrink-0" aria-hidden />
          {t('roles.sensitivePermTitle')}
        </span>
      }
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>{t('roles.cancelBtn')}</Button>
          <Button size="sm" onClick={onConfirm}>{t('roles.confirmBtn')}</Button>
        </>
      }
    >
      <p className="m-0 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
        {msg}
      </p>
    </Modal>
  )
}
