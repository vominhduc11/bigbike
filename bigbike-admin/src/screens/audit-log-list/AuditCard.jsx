import { useTranslation } from 'react-i18next'
import { formatDateTimeWithSeconds } from '../../lib/formatters'
import { Badge } from '@/components/ui/badge'
import { DANGEROUS_ACTIONS, toBadgeVariant } from './constants'

export function AuditCard({ log, onClick }) {
  const { t } = useTranslation()
  const TONE_MAP = {
    ORDER: 'info', PRODUCT: 'success', CATEGORY: 'neutral', BRAND: 'neutral',
    INVENTORY: 'warning', COUPON: 'warning', CUSTOMER: 'neutral', SETTING: 'danger',
    MEDIA: 'neutral', MENU: 'neutral', CONTENT: 'neutral', ROLE: 'danger', ADMIN_USER: 'neutral',
  }
  const moduleTone = TONE_MAP[log.resourceType] || 'neutral'
  const moduleLabel = t(`auditLog.module.${log.resourceType}`, { defaultValue: log.resourceType || t('auditLog.module.OTHER') })
  const actionLabel = log.action
    ? t(`auditLog.action.${log.action}`, { defaultValue: null }) ?? t('auditLog.actionOther', { code: log.action })
    : '—'
  const actorName = log.actorDisplayName || log.actorEmail || t(`auditLog.actorType.${log.actorType}`, { defaultValue: '' })
  const resourceLabel = log.resourceCode || log.resourceDisplayName || null
  const isDangerous = DANGEROUS_ACTIONS.has(log.action)

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
  }

  return (
    <div
      className={`audit-card${isDangerous ? ' audit-card--danger' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKey}
      aria-label={`${actionLabel}, ${formatDateTimeWithSeconds(log.createdAt)}`}
    >
      <div className="audit-card-top">
        <span className="audit-card-action">
          {isDangerous && <span className="audit-danger-icon" aria-hidden="true">⚠ </span>}
          {actionLabel}
        </span>
        <time className="audit-card-time" title={log.createdAt}>
          {formatDateTimeWithSeconds(log.createdAt)}
        </time>
      </div>
      <div className="audit-card-meta">
        <Badge variant={toBadgeVariant(moduleTone)} className="text-xs">
          {moduleLabel}
        </Badge>
        <span>{actorName}</span>
        {resourceLabel && (
          <span className="audit-resource-label text-xs">{resourceLabel}</span>
        )}
      </div>
      <div className="audit-card-chevron" aria-hidden="true">›</div>
    </div>
  )
}
