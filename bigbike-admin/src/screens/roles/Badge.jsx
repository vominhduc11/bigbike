import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function Badge({ isSystem }) {
  const { t } = useTranslation()
  const label = isSystem ? t('roles.systemBadge') : t('roles.customBadge')
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-px rounded-full text-xs font-bold tracking-wide border',
      isSystem
        ? 'bg-primary/10 text-primary border-primary/25'
        : 'bg-surface-raised text-muted-foreground border-border'
    )}>
      {label}
    </span>
  )
}
