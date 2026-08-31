import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, CircleDot, FileJson2 } from 'lucide-react'
import { Modal } from '../../components/layout'
import { DetailSection } from '../../components/DetailSection'
import { formatDateTimeWithSeconds } from '../../lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  DANGEROUS_ACTIONS,
  DANGEROUS_VALUES,
  getActionLabel,
  getModuleLabel,
  getModuleTone,
  toBadgeVariant,
  tryParse,
} from './constants'
import { DetailRow } from './cells'

function displayValue(value, t) {
  if (value === null || value === undefined || value === '') return '—'
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return t(`auditLog.value.${serialized}`, { defaultValue: serialized })
}

export function AuditDetailDrawer({ log, onClose }) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)
  const isDangerous = DANGEROUS_ACTIONS.has(log.action)
  const hasRaw = Boolean(log.beforeData || log.afterData)
  const moduleTone = getModuleTone(log.resourceType)
  const moduleLabel = getModuleLabel(t, log.resourceType)
  const actionLabel = getActionLabel(t, log.action)
  const actorName =
    log.actorDisplayName ||
    log.actorEmail ||
    t(`auditLog.actorType.${log.actorType}`, {
      defaultValue: t('auditLog.actorType.ADMIN'),
    })
  const actorTypeLabel = t(`auditLog.actorType.${log.actorType}`, {
    defaultValue: t('common.unknown'),
  })
  const resourceLabel =
    log.resourceCode ||
    log.resourceDisplayName ||
    (log.resourceId ? log.resourceId.slice(0, 8) : '—')

  const diff = useMemo(() => {
    const before = log.beforeData ? tryParse(log.beforeData) : null
    const after = log.afterData ? tryParse(log.afterData) : null
    const comparable =
      before &&
      after &&
      typeof before === 'object' &&
      typeof after === 'object' &&
      !Array.isArray(before) &&
      !Array.isArray(after)

    if (!comparable) return null

    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
    return [...allKeys].flatMap((key) => {
      const beforeSerialized =
        typeof before[key] === 'object' ? JSON.stringify(before[key]) : String(before[key])
      const afterSerialized =
        typeof after[key] === 'object' ? JSON.stringify(after[key]) : String(after[key])

      if (beforeSerialized === afterSerialized) return []

      return [
        {
          key,
          label: t(`auditLog.field.${key}`, { defaultValue: t('common.unknown') }),
          before: displayValue(before[key], t),
          after: displayValue(after[key], t),
          rawAfter:
            after[key] !== null && typeof after[key] === 'object' ? '' : String(after[key] ?? ''),
        },
      ]
    })
  }, [log.beforeData, log.afterData, t])

  return (
    <Modal
      open={Boolean(log)}
      onClose={onClose}
      title={actionLabel}
      description={`${t('auditLog.drawerTitle')} · ${formatDateTimeWithSeconds(log.createdAt)}`}
      closeLabel={t('auditLog.drawerClose')}
      wide
    >
      <div className="grid gap-5">
        {isDangerous ? (
          <Alert tone="danger" size="sm">
            {t('auditLog.drawerDangerBanner')}
          </Alert>
        ) : null}

        <DetailSection
          title={t('auditLog.drawerOverviewLabel', { defaultValue: 'Thông tin hoạt động' })}
          headingLevel={3}
          contentClassName="p-4"
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailRow label={t('auditLog.drawerTimeLabel')}>
              <time title={log.createdAt || undefined}>
                {formatDateTimeWithSeconds(log.createdAt)}
              </time>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerActorLabel')}>
              <span className="font-semibold">{actorName}</span>
              {log.actorDisplayName && log.actorEmail ? (
                <span className="mt-1 block text-xs text-muted-foreground">{log.actorEmail}</span>
              ) : null}
              {log.actorType ? (
                <Badge variant="muted" className="mt-2">
                  {actorTypeLabel}
                </Badge>
              ) : null}
            </DetailRow>

            <DetailRow label={t('auditLog.drawerActionLabel')}>
              <span className={cn('font-semibold', isDangerous && 'text-danger')}>
                {actionLabel}
              </span>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerModuleLabel')}>
              <Badge variant={toBadgeVariant(moduleTone)}>{moduleLabel}</Badge>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerEntityLabel')}>
              <span className="font-semibold">{resourceLabel}</span>
              {log.resourceCode &&
              log.resourceDisplayName &&
              log.resourceCode !== log.resourceDisplayName ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {log.resourceDisplayName}
                </span>
              ) : null}
            </DetailRow>

            {log.ipAddress ? (
              <DetailRow label={t('auditLog.drawerIpLabel')}>
                <span className="font-mono text-sm">{log.ipAddress}</span>
              </DetailRow>
            ) : null}
          </dl>
        </DetailSection>

        <DetailSection
          title={t('auditLog.drawerChangesLabel')}
          description={t('auditLog.drawerChangesHint', {
            defaultValue: 'Chỉ hiển thị những thông tin đã thay đổi.',
          })}
          headingLevel={3}
          contentClassName="p-0"
        >
          {diff && diff.length > 0 ? (
            <div className="divide-y divide-border">
              <div className="hidden grid-cols-3 gap-3 bg-surface-muted px-4 py-2 text-xs font-semibold text-muted-foreground sm:grid">
                <span>{t('auditLog.drawerFieldCol')}</span>
                <span>{t('auditLog.drawerBefore')}</span>
                <span>{t('auditLog.drawerAfter')}</span>
              </div>
              {diff.map((row) => {
                const isDangerousAfter = DANGEROUS_VALUES.has(row.rawAfter)
                return (
                  <div key={row.key} className="grid gap-3 px-4 py-3 sm:grid-cols-3">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground sm:hidden">
                        {t('auditLog.drawerFieldCol')}
                      </span>
                      <p className="mt-1 break-words text-sm font-semibold text-foreground sm:mt-0">
                        {row.label}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground sm:hidden">
                        {t('auditLog.drawerBefore')}
                      </span>
                      <p className="mt-1 break-words text-sm text-danger line-through sm:mt-0">
                        {row.before}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground sm:hidden">
                        {t('auditLog.drawerAfter')}
                      </span>
                      <p
                        className={cn(
                          'mt-1 break-words text-sm font-semibold text-success sm:mt-0',
                          isDangerousAfter && 'text-danger',
                        )}
                      >
                        {row.after}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
              <CircleDot size={16} className="mt-1 shrink-0" aria-hidden="true" />
              <p>{t('auditLog.drawerNoChanges')}</p>
            </div>
          )}
        </DetailSection>

        {hasRaw ? (
          <section className="rounded-md border border-border bg-surface">
            <Button
              variant="ghost"
              className="min-h-11 w-full justify-between px-4"
              onClick={() => setShowRaw((current) => !current)}
              aria-expanded={showRaw}
            >
              <span className="inline-flex items-center gap-2">
                <FileJson2 size={16} aria-hidden="true" />
                {t('auditLog.drawerTechData')}
              </span>
              {showRaw ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </Button>

            {showRaw ? (
              <div className="grid gap-4 border-t border-border p-4">
                <p className="text-xs text-muted-foreground">
                  {t('auditLog.drawerRawHint', {
                    defaultValue: 'Dữ liệu gốc dành cho đối soát chuyên sâu.',
                  })}
                </p>
                {log.beforeData ? (
                  <div className="grid gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('auditLog.drawerBefore')}
                    </h4>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-muted p-3 font-mono text-xs text-foreground">
                      {JSON.stringify(tryParse(log.beforeData) ?? log.beforeData, null, 2)}
                    </pre>
                  </div>
                ) : null}
                {log.afterData ? (
                  <div className="grid gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('auditLog.drawerAfter')}
                    </h4>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-muted p-3 font-mono text-xs text-foreground">
                      {JSON.stringify(tryParse(log.afterData) ?? log.afterData, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </Modal>
  )
}
