import { Shield, Check, X, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/layout/Modal'

export function SaveSummaryDialog({
  pending, roleName, assignedUserCount = 0, permLabels, sensitiveKeys,
  isOwnRole, onConfirm, onCancel, saving,
}) {
  const { t } = useTranslation()
  const added   = pending?.added   || []
  const removed = pending?.removed || []
  const userAdded = pending?.userAdded || added
  const autoAdded = pending?.autoAdded || []
  const userCount = Number.isFinite(Number(assignedUserCount))
    ? Math.max(0, Math.trunc(Number(assignedUserCount)))
    : 0
  const sensitiveAdded   = added.filter(k => sensitiveKeys.has(k))
  const sensitiveRemoved = removed.filter(k => sensitiveKeys.has(k))
  const hasSensitive = sensitiveAdded.length > 0 || sensitiveRemoved.length > 0
  return (
    <Modal
      open={!!pending}
      onClose={onCancel}
      title={
        <span className="flex items-center gap-3">
          <Shield size={20} className="text-primary shrink-0" aria-hidden />
          {t('roles.saveSummaryTitle')}
        </span>
      }
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>{t('roles.cancelBtn')}</Button>
          <Button size="sm" onClick={onConfirm} loading={saving} className="flex items-center gap-2">
            {t('roles.confirmSaveBtn')}
          </Button>
        </>
      }
    >
      <p className="m-0 mb-4 text-sm text-muted-foreground">
        {t('roles.saveSummaryRole', { name: roleName })}
      </p>

      {userCount > 0 && (
        <Alert tone="warning" size="sm" className="mb-4">
          {t('roles.assignedUserWarning', { count: userCount })}
        </Alert>
      )}

      {userAdded.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-bold text-success mb-2 uppercase tracking-wider">
            + {t('roles.saveSummaryAdding')}
          </div>
          {userAdded.map(k => (
            <div key={k} className="flex items-center gap-2 py-1 text-sm">
              <Check size={12} className="text-success shrink-0" aria-hidden />
              <span className="text-foreground">{permLabels[k] || k}</span>
              {sensitiveKeys.has(k) && (
                <AlertTriangle size={12} className="text-warning shrink-0" aria-label={t('roles.sensitivePermNote')} />
              )}
            </div>
          ))}
        </div>
      )}

      {autoAdded.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-bold text-info mb-2 uppercase tracking-wider">
            + Tự thêm do phụ thuộc
          </div>
          {autoAdded.map(k => (
            <div key={k} className="flex items-center gap-2 py-1 text-sm">
              <Check size={12} className="text-info shrink-0" aria-hidden />
              <span className="text-foreground">{permLabels[k] || k}</span>
              <span className="text-xs text-muted-foreground">Bắt buộc để tổ hợp quyền sử dụng được</span>
            </div>
          ))}
        </div>
      )}

      {removed.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-bold text-danger mb-2 uppercase tracking-wider">
            − {t('roles.saveSummaryRemoving')}
          </div>
          {removed.map(k => (
            <div key={k} className="flex items-center gap-2 py-1 text-sm">
              <X size={12} className="text-danger shrink-0" aria-hidden />
              <span className="text-foreground">{permLabels[k] || k}</span>
              {sensitiveKeys.has(k) && (
                <AlertTriangle size={12} className="text-warning shrink-0" aria-label={t('roles.sensitivePermNote')} />
              )}
            </div>
          ))}
        </div>
      )}

      {hasSensitive && (
        <Alert tone="warning" size="sm" className="mb-0">
          {t('roles.saveSensitiveWarning')}
        </Alert>
      )}

      {isOwnRole && removed.length > 0 && (
        <Alert tone="danger" size="sm" className="mt-3 mb-0">
          {t('roles.saveOwnRoleWarning', {
            defaultValue: 'Bạn đang sửa role của chính mình. Gỡ quyền ở đây sẽ ảnh hưởng trực tiếp tới quyền truy cập của bạn.',
          })}
        </Alert>
      )}
    </Modal>
  )
}
