import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/layout/Modal'
import { getRoleDisplayName } from './constants'

export function DeleteRoleDialog({ role, onConfirm, onCancel, saving }) {
  const { t } = useTranslation()
  return (
    <Modal
      open={!!role}
      onClose={onCancel}
      title={
        <span className="flex items-center gap-2.5">
          <Trash2 size={20} className="text-danger shrink-0" aria-hidden />
          {t('roles.deleteRoleTitle')}
        </span>
      }
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            {t('roles.cancelBtn')}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={saving}>
            {t('roles.deleteRoleBtn')}
          </Button>
        </>
      }
    >
      <p className="m-0 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
        {role ? t('roles.deleteRoleConfirm', { name: getRoleDisplayName(role, t) }) : ''}
      </p>
    </Modal>
  )
}
