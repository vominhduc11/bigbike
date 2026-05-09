/**
 * Read-only summary of currently applied filters with per-chip remove buttons
 * and a single "Clear all" action.
 *
 * Props:
 *   chips: Array<{ key: string, label: string, onRemove: () => void }>
 *   onClearAll?: () => void
 */
export function FilterChips({ chips, onClearAll, clearAllLabel = 'Clear all' }) {
  if (!chips || chips.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.75rem' }}>
      {chips.map((c) => (
        <span key={c.key}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            background: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)',
            borderRadius: 999, padding: '2px 4px 2px 10px',
            fontSize: '0.75rem', color: 'var(--c-text)',
          }}>
          {c.label}
          <button type="button" onClick={c.onRemove} aria-label="Remove filter"
            style={{
              all: 'unset', cursor: 'pointer', width: 18, height: 18,
              borderRadius: '50%', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-text-muted)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-danger)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-muted)' }}
          >✕</button>
        </span>
      ))}
      {onClearAll && (
        <button type="button" onClick={onClearAll}
          style={{
            all: 'unset', cursor: 'pointer',
            fontSize: '0.75rem', color: 'var(--c-primary)',
            padding: '2px 8px', borderRadius: 4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
        >
          {clearAllLabel}
        </button>
      )}
    </div>
  )
}
