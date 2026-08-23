import { useTranslation } from 'react-i18next'

function HeaderSkeleton() {
  return (
    <div className="mb-5 flex flex-col gap-2">
      <div className="h-3 w-24 rounded-xs bg-surface-muted" />
      <div className="h-7 w-64 max-w-full rounded-xs bg-surface-muted" />
      <div className="h-3 w-80 max-w-full rounded-xs bg-surface-muted" />
    </div>
  )
}

function TableSkeleton({ count }) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="h-9 w-56 max-w-full rounded-sm bg-surface-muted" />
        <div className="h-9 w-32 rounded-sm bg-surface-muted" />
        <div className="h-9 w-32 rounded-sm bg-surface-muted" />
      </div>
      <div className="overflow-hidden rounded-[var(--admin-radius-card)] border border-border">
        <div className="h-10 border-b border-border bg-surface-muted/60" />
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex min-h-12 items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <div className="h-4 flex-1 rounded-xs bg-surface-muted" />
            <div className="h-4 w-24 rounded-xs bg-surface-muted" />
            <div className="h-4 w-16 rounded-xs bg-surface-muted" />
          </div>
        ))}
      </div>
    </>
  )
}

function FormSkeleton({ count }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-[var(--admin-radius-card)] border border-border bg-surface">
          <div className="flex h-14 items-center border-b border-border bg-surface-muted px-5">
            <div className="h-4 w-40 rounded-xs bg-surface-raised" />
          </div>
          <div className="grid gap-4 p-5">
            <div className="h-4 w-28 rounded-xs bg-surface-muted" />
            <div className="h-10 w-full rounded-sm bg-surface-muted" />
            <div className="h-4 w-36 rounded-xs bg-surface-muted" />
            <div className="h-24 w-full rounded-sm bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function CardsSkeleton({ count }) {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-[var(--admin-radius-card)] border border-border bg-surface">
          <div className="aspect-[4/3] bg-surface-muted" />
          <div className="grid gap-2 p-3">
            <div className="h-3 w-5/6 rounded-xs bg-surface-muted" />
            <div className="h-3 w-2/5 rounded-xs bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ScreenSkeleton({ variant = 'table', count, showHeader = true, label }) {
  const { t } = useTranslation()
  const resolvedCount = count ?? (variant === 'table' ? 8 : variant === 'cards' ? 12 : 4)
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label || t('common.loading')}</span>
      <div className="animate-pulse" aria-hidden="true">
        {showHeader ? <HeaderSkeleton /> : null}
        {variant === 'form' ? <FormSkeleton count={resolvedCount} /> : null}
        {variant === 'cards' ? <CardsSkeleton count={resolvedCount} /> : null}
        {variant === 'table' ? <TableSkeleton count={resolvedCount} /> : null}
      </div>
    </div>
  )
}
