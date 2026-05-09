/**
 * Floating action bar shown when one or more items are selected.
 * Sticky at the top of the content area.
 */
export function BulkActionBar({ selectedCount, onClear, actions = [] }) {
  if (!selectedCount) return null
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 5,
      background: 'var(--c-primary)', color: '#fff',
      padding: '0.6rem 1rem', borderRadius: 6, marginBottom: '0.75rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    }}>
      <span style={{ fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>
        {selectedCount}
      </span>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        {actions.map((a, i) => (
          <button key={i} type="button" onClick={a.onClick} disabled={a.disabled}
            style={{
              background: a.tone === 'danger' ? 'var(--c-danger)' : 'rgba(255,255,255,0.18)',
              color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
              padding: '0.3rem 0.8rem', borderRadius: 4,
              fontSize: '0.8rem', fontWeight: 600,
              cursor: a.disabled ? 'not-allowed' : 'pointer',
              opacity: a.disabled ? 0.6 : 1,
            }}>
            {a.label}
          </button>
        ))}
        <button type="button" onClick={onClear}
          style={{
            background: 'transparent', color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '0.3rem 0.8rem', borderRadius: 4,
            fontSize: '0.8rem', cursor: 'pointer',
          }}>
          ✕
        </button>
      </div>
    </div>
  )
}
