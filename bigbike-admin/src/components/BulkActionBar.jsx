import { X } from 'lucide-react'

export function BulkActionBar({ selectedCount, onClear, actions = [], closeLabel = 'Bỏ chọn' }) {
  if (!selectedCount) return null

  return (
    <div className="bb-bulk-bar">
      <span className="count">{selectedCount} đã chọn</span>
      <span className="sep" />
      <div className="bb-row" style={{ gap: 6 }}>
        {actions.map((action, index) => (
          <button
            key={index}
            type="button"
            className={`bulk-btn${action.tone === 'danger' ? ' danger' : ''}`}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          className="bulk-btn"
          onClick={onClear}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
