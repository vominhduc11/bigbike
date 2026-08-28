import { Shield, Check, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function RoleSummaryCard({ activePerms, isSuperAdmin, sensitiveKeys }) {
  const { t } = useTranslation()
  const permCount = isSuperAdmin ? '∞' : activePerms.size
  const hasSensitive = isSuperAdmin || [...sensitiveKeys].some(p => activePerms.has(p))

  return (
    <div className="flex flex-wrap gap-4 py-3 mb-4 border-b border-border text-sm">
      <div className="flex items-center gap-2">
        <Shield size={14} className="text-primary shrink-0" aria-hidden />
        <span className="text-muted-foreground">
          {t('roles.summaryPermCount', { count: permCount })}
        </span>
      </div>
      {hasSensitive ? (
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-warning shrink-0" aria-hidden />
          <span className="text-warning font-medium">
            {t('roles.summaryHasSensitive')}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Check size={14} className="text-success shrink-0" aria-hidden />
          <span className="text-muted-foreground">
            {t('roles.summaryNoSensitive')}
          </span>
        </div>
      )}
    </div>
  )
}
