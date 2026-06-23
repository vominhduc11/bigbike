import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { DANGEROUS_ACTIONS, toBadgeVariant } from './constants'

export function ModuleBadge({ resourceType }) {
  const { t } = useTranslation()
  const TONE_MAP = {
    ORDER: 'info', PRODUCT: 'success', CATEGORY: 'neutral', BRAND: 'neutral',
    INVENTORY: 'warning', CUSTOMER: 'neutral', SETTING: 'danger',
    MEDIA: 'neutral', MENU: 'neutral', CONTENT: 'neutral', ROLE: 'danger', ADMIN_USER: 'neutral', REDIRECT: 'warning',
  }
  const tone = TONE_MAP[resourceType] || 'neutral'
  const label = t(`auditLog.module.${resourceType}`, { defaultValue: resourceType || t('auditLog.module.OTHER') })
  return <Badge variant={toBadgeVariant(tone)}>{label}</Badge>
}

export function ActorCell({ log }) {
  const { t } = useTranslation()
  const displayName = log.actorDisplayName || log.actorEmail || null
  const fallback = t(`auditLog.actorType.${log.actorType}`, { defaultValue: t('auditLog.actorType.ADMIN') })
  const actorTypeLabel = log.actorType && log.actorType !== 'ADMIN'
    ? t(`auditLog.actorType.${log.actorType}`, { defaultValue: log.actorType })
    : null

  return (
    <div className="audit-actor-cell">
      {displayName
        ? <span className="audit-actor-name">
            {displayName}
            {actorTypeLabel && <span className="audit-actor-type"> ({actorTypeLabel})</span>}
          </span>
        : <span className="audit-actor-unknown">{fallback}</span>
      }
    </div>
  )
}

export function ResourceCell({ log }) {
  const label = log.resourceCode || log.resourceDisplayName || null
  if (label) return <span className="audit-resource-label">{label}</span>
  if (log.resourceId) {
    // #9: show raw ID instead of "ID #abc123" prefix — just the short hex
    return <span className="audit-resource-label audit-resource-id" title={log.resourceId}>{log.resourceId.slice(0, 8)}</span>
  }
  return <span className="text-muted-foreground">—</span>
}

export function ActionLabel({ action }) {
  const { t } = useTranslation()
  const isDangerous = DANGEROUS_ACTIONS.has(action)
  // #9: fall back to raw code in parens rather than generic "other activity"
  const label = action
    ? t(`auditLog.action.${action}`, { defaultValue: null }) ?? t('auditLog.actionOther', { code: action })
    : '—'

  return (
    <span className={`audit-action-label${isDangerous ? ' audit-action-danger' : ''}`}>
      {isDangerous && <span className="audit-danger-icon" aria-label={label}>⚠</span>}
      {label}
    </span>
  )
}

export function DetailRow({ label, children }) {
  return (
    <div className="audit-detail-row">
      <span className="audit-detail-label">{label}</span>
      <span className="audit-detail-value">{children}</span>
    </div>
  )
}
