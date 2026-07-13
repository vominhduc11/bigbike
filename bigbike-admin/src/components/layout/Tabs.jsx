import { useRef } from 'react'

/**
 * Tabs — segmented tab bar.
 *
 * items: [{ key, label, count? }]
 * value: currently selected key
 * onChange: (key) => void
 *
 * Điều hướng bàn phím theo WAI-ARIA tablist: roving tabindex (chỉ tab active
 * nhận Tab), phím Mũi tên chuyển tab (vòng), Home/End về đầu/cuối. Panel do
 * consumer render tách rời nên không nối aria-controls (tránh trỏ id không có).
 */
export function Tabs({ items, value, onChange, ariaLabel }) {
  const tabRefs = useRef([])

  const moveTo = (index) => {
    if (!items.length) return
    const next = (index + items.length) % items.length
    const item = items[next]
    if (!item) return
    onChange(item.key)
    tabRefs.current[next]?.focus()
  }

  const handleKeyDown = (e, index) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        moveTo(index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        moveTo(index - 1)
        break
      case 'Home':
        e.preventDefault()
        moveTo(0)
        break
      case 'End':
        e.preventDefault()
        moveTo(items.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div className="seg-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const active = item.key === value
        return (
          <button
            key={item.key}
            ref={(el) => { tabRefs.current[index] = el }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={active ? 'seg-tabs-tab is-active' : 'seg-tabs-tab'}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <span>{item.label}</span>
            {item.count != null ? <span className="seg-tabs-count">{item.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
