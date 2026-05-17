export function MediaCardSkeleton() {
  return (
    <div className="border border-border rounded-md overflow-hidden bg-surface">
      <div className="skeleton-shimmer h-[120px] bg-surface-muted" />
      <div className="p-2">
        <div className="skeleton-shimmer h-3 w-[85%] bg-surface-muted rounded-sm mb-1.5" />
        <div className="skeleton-shimmer h-2.5 w-[40%] bg-surface-muted rounded-sm" />
      </div>
    </div>
  )
}

export function MediaGridSkeleton({ count = 12 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: count }).map((_, i) => <MediaCardSkeleton key={i} />)}
    </div>
  )
}
