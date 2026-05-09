export function MediaCardSkeleton() {
  return (
    <div style={{
      border: '1px solid var(--c-border)',
      borderRadius: 6, overflow: 'hidden',
      background: 'var(--c-surface)',
    }}>
      <div className="skeleton-shimmer" style={{ height: 120, background: 'var(--c-bg-subtle)' }} />
      <div style={{ padding: '0.5rem' }}>
        <div className="skeleton-shimmer" style={{ height: 12, width: '85%', background: 'var(--c-bg-subtle)', borderRadius: 3, marginBottom: 6 }} />
        <div className="skeleton-shimmer" style={{ height: 10, width: '40%', background: 'var(--c-bg-subtle)', borderRadius: 3 }} />
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
