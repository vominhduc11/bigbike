import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MobileCard } from '../../components/layout'
import { cn } from '@/lib/utils'
import { getAuditCardData } from './constants'
import { ModuleBadge } from './cells'

export function AuditCard({ log, onClick }) {
  const { t } = useTranslation()
  const card = getAuditCardData(log, t)

  return (
    <MobileCard
      title={
        <span
          className={cn(
            'flex items-start gap-2 font-semibold leading-snug',
            card.isDangerous && 'text-danger',
          )}
        >
          {card.isDangerous ? (
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : null}
          <span>{card.actionLabel}</span>
        </span>
      }
      subtitle={<time title={log.createdAt || undefined}>{card.timeLabel}</time>}
      status={<ModuleBadge resourceType={log.resourceType} />}
      meta={[
        {
          label: t('auditLog.colActor'),
          value: card.actorLabel,
          tone: 'strong',
        },
        {
          label: t('auditLog.colEntity'),
          value: card.resourceLabel,
        },
      ]}
      onClick={onClick}
      selectionLabel={card.selectionLabel}
    />
  )
}
