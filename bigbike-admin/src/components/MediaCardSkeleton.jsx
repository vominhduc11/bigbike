import { useTranslation } from 'react-i18next'

export function MediaCardSkeleton() {
  return (
    <div aria-hidden="true" className="border border-border rounded-md overflow-hidden bg-surface">
      <div className="skeleton-shimmer aspect-[4/3] bg-surface-muted" />
      <div className="p-2">
        <div className="skeleton-shimmer h-3 w-[85%] bg-surface-muted rounded-sm mb-1.5" />
        <div className="skeleton-shimmer h-2.5 w-[40%] bg-surface-muted rounded-sm" />
      </div>
    </div>
  )
}

export function MediaGridSkeleton({ count = 12 }) {
  const { t } = useTranslation()
  return (
    <div role="status" aria-busy="true"
      className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: count }).map((_, i) => <MediaCardSkeleton key={i} />)}
    </div>
  )
}
