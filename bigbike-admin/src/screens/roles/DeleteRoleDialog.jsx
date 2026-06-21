import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { getRoleDisplayName } from './constants'

export function DeleteRoleDialog({ role, onConfirm, onCancel, saving }) {
  const { t } = useTranslation()
  if (!role) return null
  return (
    <div
      className="roles-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-role-title"
      onClick={onCancel}
    >
      <div className="roles-confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-3">
          <Trash2 size={20} className="text-danger shrink-0" aria-hidden />
          <strong id="delete-role-title" className="text-base text-foreground">
            {t('roles.deleteRoleTitle')}
          </strong>
        </div>
        <p className="m-0 mb-5 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
          {t('roles.deleteRoleConfirm', { name: getRoleDisplayName(role, t) })}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            {t('roles.cancelBtn')}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={saving}>
            {t('roles.deleteRoleBtn')}
          </Button>
        </div>
      </div>
    </div>
  )
}
