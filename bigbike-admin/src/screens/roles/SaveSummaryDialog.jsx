import { Shield, Check, X, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

export function SaveSummaryDialog({ pending, roleName, permLabels, sensitiveKeys, isOwnRole, onConfirm, onCancel, saving }) {
  const { t } = useTranslation()
  if (!pending) return null
  const { added, removed } = pending
  const sensitiveAdded   = added.filter(k => sensitiveKeys.has(k))
  const sensitiveRemoved = removed.filter(k => sensitiveKeys.has(k))
  const hasSensitive = sensitiveAdded.length > 0 || sensitiveRemoved.length > 0
  return (
    <div
      className="roles-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-summary-title"
      onClick={onCancel}
    >
      <div className="roles-confirm-dialog max-w-[500px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-3">
          <Shield size={20} className="text-primary shrink-0" aria-hidden />
          <strong id="save-summary-title" className="text-base text-foreground">
            {t('roles.saveSummaryTitle')}
          </strong>
        </div>
        <p className="m-0 mb-4 text-sm text-muted-foreground">
          {t('roles.saveSummaryRole', { name: roleName })}
        </p>

        {added.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-bold text-success mb-1.5 uppercase tracking-wider">
              + {t('roles.saveSummaryAdding')}
            </div>
            {added.map(k => (
              <div key={k} className="flex items-center gap-1.5 py-0.5 text-sm">
                <Check size={12} className="text-success shrink-0" aria-hidden />
                <span className="text-foreground">{permLabels[k] || k}</span>
                {sensitiveKeys.has(k) && (
                  <AlertTriangle size={12} className="text-warning shrink-0" aria-label={t('roles.sensitivePermNote')} />
                )}
              </div>
            ))}
          </div>
        )}

        {removed.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-bold text-danger mb-1.5 uppercase tracking-wider">
              − {t('roles.saveSummaryRemoving')}
            </div>
            {removed.map(k => (
              <div key={k} className="flex items-center gap-1.5 py-0.5 text-sm">
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
          <Alert tone="warning" size="sm" className="mb-4">
            {t('roles.saveSensitiveWarning')}
          </Alert>
        )}

        {isOwnRole && removed.length > 0 && (
          <Alert tone="danger" size="sm" className="mb-4">
            {t('roles.saveOwnRoleWarning', {
              defaultValue: 'Bạn đang sửa role của chính mình. Gỡ quyền ở đây sẽ ảnh hưởng trực tiếp tới quyền truy cập của bạn.',
            })}
          </Alert>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>{t('roles.cancelBtn')}</Button>
          <Button size="sm" onClick={onConfirm} loading={saving} className="flex items-center gap-1.5">
            {t('roles.confirmSaveBtn')}
          </Button>
        </div>
      </div>
    </div>
  )
}
