import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { PERM_LABEL_KEY_MAP } from './constants'

export function ConfirmSensitiveDialog({ pending, roleName, onConfirm, onCancel }) {
  const { t } = useTranslation()
  if (!pending) return null
  const permLabelKey = PERM_LABEL_KEY_MAP[pending.key]
  const permLabel = permLabelKey ? t(permLabelKey) : pending.label
  const msg = pending.willAdd
    ? t('roles.sensitivePermAdd', { perm: permLabel, role: roleName })
    : t('roles.sensitivePermRemove', { perm: permLabel, role: roleName })
  return (
    <div
      className="roles-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sensitive-dialog-title"
      onClick={onCancel}
    >
      <div className="roles-confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-3">
          <AlertTriangle size={20} className="text-warning shrink-0" aria-hidden />
          <strong id="sensitive-dialog-title" className="text-base text-foreground">
            {t('roles.sensitivePermTitle')}
          </strong>
        </div>
        <p className="m-0 mb-5 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
          {msg}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>{t('roles.cancelBtn')}</Button>
          <Button size="sm" onClick={onConfirm}>{t('roles.confirmBtn')}</Button>
        </div>
      </div>
    </div>
  )
}
