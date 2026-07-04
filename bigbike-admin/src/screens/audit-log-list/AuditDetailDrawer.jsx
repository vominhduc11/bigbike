import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/layout'
import { formatDateTimeWithSeconds } from '../../lib/formatters'
import { Badge } from '@/components/ui/badge'
import { DANGEROUS_ACTIONS, DANGEROUS_VALUES, toBadgeVariant, tryParse } from './constants'
import { DetailRow } from './cells'

export function AuditDetailDrawer({ log, onClose }) {
  const { t } = useTranslation()
  const isDangerous = DANGEROUS_ACTIONS.has(log.action)
  const hasRaw = !!(log.beforeData || log.afterData)
  const [showRaw, setShowRaw] = useState(false)

  const TONE_MAP = {
    ORDER: 'info', PRODUCT: 'success', CATEGORY: 'neutral', BRAND: 'neutral',
    INVENTORY: 'warning', CUSTOMER: 'neutral', SITE_SETTING: 'danger',
    MEDIA: 'neutral', MENU: 'neutral', CONTENT: 'neutral', ADMIN_ROLE: 'danger', ADMIN_USER: 'neutral', REDIRECT: 'warning',
  }
  const moduleTone = TONE_MAP[log.resourceType] || 'neutral'
  const moduleLabel = t(`auditLog.module.${log.resourceType}`, { defaultValue: log.resourceType || t('auditLog.module.OTHER') })
  const actionLabel = log.action
    ? t(`auditLog.action.${log.action}`, { defaultValue: null }) ?? t('auditLog.actionOther', { code: log.action })
    : '—'
  const displayName = log.actorDisplayName || log.actorEmail || null
  const actorFallback = t(`auditLog.actorType.${log.actorType}`, { defaultValue: t('auditLog.actorType.ADMIN') })

  const diff = useMemo(() => {
    const before = log.beforeData ? tryParse(log.beforeData) : null
    const after  = log.afterData  ? tryParse(log.afterData)  : null
    if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) return null
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
    const changes = []
    for (const key of allKeys) {
      if (String(before[key]) !== String(after[key])) {
        const mapVal = (v) => {
          if (v === null || v === undefined) return '—'
          const str = String(v)
          return t(`auditLog.value.${str}`, { defaultValue: str })
        }
        changes.push({
          key,
          label: t(`auditLog.field.${key}`, { defaultValue: key }),
          before: mapVal(before[key]),
          after:  mapVal(after[key]),
          rawAfter: String(after[key] ?? ''),
        })
      }
    }
    return changes
  }, [log.beforeData, log.afterData, t])

  return (
    <Modal
      open={Boolean(log)}
      onClose={onClose}
      title={t('auditLog.drawerTitle')}
      closeLabel={t('auditLog.drawerClose')}
      wide
    >
      <div className="-mx-5 -my-4">
        <div className="audit-drawer-body">
          {isDangerous && (
            <div className="audit-danger-banner">
              ⚠ {t('auditLog.drawerDangerBanner')}
            </div>
          )}

          <div className="audit-detail-section">
            <DetailRow label={t('auditLog.drawerTimeLabel')}>
              <time title={log.createdAt}>{formatDateTimeWithSeconds(log.createdAt)}</time>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerActorLabel')}>
              <div className="flex flex-wrap items-center gap-1.5">
                {displayName
                  ? <strong className="text-sm">{displayName}</strong>
                  : <span className="text-sm italic text-muted-foreground">{actorFallback}</span>
                }
                {log.actorType && log.actorType !== 'ADMIN' && (
                  <Badge variant="muted" className="text-xs">
                    {t(`auditLog.actorType.${log.actorType}`, { defaultValue: log.actorType })}
                  </Badge>
                )}
              </div>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerActionLabel')}>
              <strong>{actionLabel}</strong>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerModuleLabel')}>
              <Badge variant={toBadgeVariant(moduleTone)}>{moduleLabel}</Badge>
            </DetailRow>

            {(log.resourceCode || log.resourceDisplayName || log.resourceId) && (
              <DetailRow label={t('auditLog.drawerEntityLabel')}>
                <strong className="text-sm">
                  {log.resourceCode || log.resourceDisplayName || log.resourceId?.slice(0, 8)}
                </strong>
              </DetailRow>
            )}
          </div>

          <div className="audit-drawer-section">
            <h3 className="audit-drawer-section-title">{t('auditLog.drawerChangesLabel')}</h3>
            {(!diff || diff.length === 0) && (
              <p className="audit-no-changes">{t('auditLog.drawerNoChanges')}</p>
            )}
            {diff && diff.length > 0 && (
              <table className="audit-diff-table">
                <thead>
                  <tr>
                    <th>{t('auditLog.drawerFieldCol')}</th>
                    <th>{t('auditLog.drawerBefore')}</th>
                    <th>{t('auditLog.drawerAfter')}</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((row) => {
                    const isDangerousAfter = DANGEROUS_VALUES.has(row.rawAfter)
                    return (
                      <tr key={row.key}>
                        <td className="audit-diff-field">{row.label}</td>
                        <td className="audit-diff-before">{row.before}</td>
                        <td className={`audit-diff-after${isDangerousAfter ? ' audit-diff-after--danger' : ''}`}>{row.after}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* #2: Raw JSON panel — only shown if data exists; hidden for non-dev but togglable */}
          {hasRaw && (
            <div className="audit-drawer-section">
              <button
                type="button"
                className="audit-tech-toggle"
                onClick={() => setShowRaw((p) => !p)}
                aria-expanded={showRaw}
              >
                {t('auditLog.drawerTechData')}
                <span aria-hidden="true" className="ml-1">{showRaw ? '▲' : '▼'}</span>
              </button>
              {showRaw && (
                <div className="audit-tech-body">
                  {log.beforeData && (
                    <>
                      <p className="audit-tech-label">{t('auditLog.drawerBefore')}</p>
                      <pre className="audit-tech-pre">
                        {JSON.stringify(tryParse(log.beforeData) ?? log.beforeData, null, 2)}
                      </pre>
                    </>
                  )}
                  {log.afterData && (
                    <>
                      <p className="audit-tech-label mt-3">{t('auditLog.drawerAfter')}</p>
                      <pre className="audit-tech-pre">
                        {JSON.stringify(tryParse(log.afterData) ?? log.afterData, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
