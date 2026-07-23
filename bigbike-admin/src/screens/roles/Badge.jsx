import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function Badge({ isSystem, assignedUserCount = 0 }) {
  const { t } = useTranslation()
  const label = isSystem ? t('roles.systemBadge') : t('roles.customBadge')
  const userCount = Number.isFinite(Number(assignedUserCount))
    ? Math.max(0, Math.trunc(Number(assignedUserCount)))
    : 0
  return (
    <>
      <span className={cn(
        'inline-flex items-center px-2 py-px rounded-full text-xs font-bold tracking-wide border whitespace-nowrap',
        isSystem
          ? 'bg-primary/10 text-primary border-primary/25'
          : 'bg-surface-raised text-muted-foreground border-border'
      )}>
        {label}
      </span>
      {userCount > 0 && (
        <span
          className="inline-flex items-center px-2 py-px rounded-full text-xs font-semibold tracking-wide border bg-surface-raised text-muted-foreground border-border whitespace-nowrap shrink-0"
          aria-label={t('roles.assignedUserCountAria', { count: userCount })}
        >
          {t('roles.assignedUserCount', { count: userCount })}
        </span>
      )}
    </>
  )
}
