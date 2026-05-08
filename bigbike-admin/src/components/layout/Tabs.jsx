/**
 * Tabs — segmented tab bar.
 *
 * items: [{ key, label, count? }]
 * value: currently selected key
 * onChange: (key) => void
 */
export function Tabs({ items, value, onChange, ariaLabel }) {
  return (
    <div className="seg-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.key === value
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'seg-tabs-tab is-active' : 'seg-tabs-tab'}
            onClick={() => onChange(item.key)}
          >
            <span>{item.label}</span>
            {item.count != null ? <span className="seg-tabs-count">{item.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
