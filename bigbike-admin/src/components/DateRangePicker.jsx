import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { vi } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { CalendarDays, X } from 'lucide-react'

function formatDateLabel(date) {
  if (!date) return ''
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function DateRangePicker({ value, onChange, placeholder = 'Tất cả thời gian' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasValue = value?.from || value?.to

  const label = hasValue
    ? `${formatDateLabel(value.from)} — ${value.to ? formatDateLabel(value.to) : '...'}`
    : placeholder

  function handleClear(e) {
    e.stopPropagation()
    onChange(undefined)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 34, padding: '0 10px',
          border: `1px solid ${open ? 'var(--admin-color-brand-red)' : 'var(--admin-color-border-default)'}`,
          borderRadius: 'var(--admin-radius-sm)',
          background: 'var(--admin-color-surface-base)',
          color: hasValue ? 'var(--admin-color-text-primary)' : 'var(--admin-color-text-muted)',
          fontSize: 'var(--admin-text-sm)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'var(--admin-transition-fast)',
          minWidth: 180,
        }}
      >
        <CalendarDays size={14} style={{ flexShrink: 0, color: 'var(--admin-color-text-muted)' }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        {hasValue && (
          <X
            size={13}
            onClick={handleClear}
            style={{ color: 'var(--admin-color-text-muted)', flexShrink: 0 }}
          />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 200,
          background: 'var(--admin-color-surface-base)',
          border: '1px solid var(--admin-color-border-subtle)',
          borderRadius: 'var(--admin-radius-lg)',
          boxShadow: 'var(--admin-shadow-lg)',
          padding: 8,
        }}>
          <DayPicker
            locale={vi}
            mode="range"
            selected={value}
            onSelect={(range) => {
              onChange(range)
              if (range?.from && range?.to) setOpen(false)
            }}
            disabled={{ after: new Date() }}
            styles={{
              root: { '--rdp-accent-color': 'var(--admin-color-brand-red)', '--rdp-accent-background-color': 'var(--admin-color-brand-red-subtle)', fontFamily: 'inherit', fontSize: '0.8125rem' },
            }}
          />
          {hasValue && (
            <div style={{ borderTop: '1px solid var(--admin-color-border-subtle)', padding: '8px 8px 4px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleClear}
                style={{ fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              >
                Xoá bộ lọc ngày
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
