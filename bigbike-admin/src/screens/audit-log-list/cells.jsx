import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  DANGEROUS_ACTIONS,
  getActionLabel,
  getModuleLabel,
  getModuleTone,
  toBadgeVariant,
} from './constants'

export function ModuleBadge({ resourceType }) {
  const { t } = useTranslation()
  const tone = getModuleTone(resourceType)
  const label = getModuleLabel(t, resourceType)
  return <Badge variant={toBadgeVariant(tone)}>{label}</Badge>
}

export function ActorCell({ log }) {
  const { t } = useTranslation()
  const displayName = log.actorDisplayName || log.actorEmail || null
  const fallback = t(`auditLog.actorType.${log.actorType}`, {
    defaultValue: t('auditLog.actorType.ADMIN'),
  })
  const secondary = log.actorDisplayName && log.actorEmail
    ? log.actorEmail
    : (log.actorType && log.actorType !== 'ADMIN'
      ? t(`auditLog.actorType.${log.actorType}`, { defaultValue: t('common.unknown') })
      : null)

  return (
    <div className="min-w-0">
      <span className={cn(
        'block max-w-48 truncate text-sm font-medium text-foreground',
        !displayName && 'italic text-muted-foreground',
      )}>
        {displayName || fallback}
      </span>
      {secondary ? (
        <span className="mt-1 block max-w-48 truncate text-xs text-muted-foreground">
          {secondary}
        </span>
      ) : null}
    </div>
  )
}

export function ResourceCell({ log }) {
  const primary = log.resourceCode
    || log.resourceDisplayName
    || (log.resourceId ? log.resourceId.slice(0, 8) : null)
  const secondary = log.resourceCode && log.resourceDisplayName
    && log.resourceCode !== log.resourceDisplayName
    ? log.resourceDisplayName
    : null

  if (!primary) return <span className="text-muted-foreground">—</span>

  return (
    <div className="min-w-0">
      <span
        className={cn(
          'block max-w-56 truncate text-sm font-medium text-foreground',
          !log.resourceCode && !log.resourceDisplayName && 'font-mono text-xs text-muted-foreground',
        )}
        title={log.resourceId || primary}
      >
        {primary}
      </span>
      {secondary ? (
        <span className="mt-1 block max-w-56 truncate text-xs text-muted-foreground">
          {secondary}
        </span>
      ) : null}
    </div>
  )
}

export function ActionLabel({ action }) {
  const { t } = useTranslation()
  const isDangerous = DANGEROUS_ACTIONS.has(action)
  const label = getActionLabel(t, action)

  return (
    <span className={cn(
      'inline-flex items-start gap-2 text-sm font-medium text-foreground',
      isDangerous && 'text-danger',
    )}>
      {isDangerous ? <AlertTriangle size={14} className="mt-1 shrink-0" aria-hidden="true" /> : null}
      <span>{label}</span>
    </span>
  )
}

export function DetailRow({ label, children }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface-muted p-3">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{children}</dd>
    </div>
  )
}
