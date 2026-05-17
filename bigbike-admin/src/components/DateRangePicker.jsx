import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DayPicker } from 'react-day-picker'
import { enUS, vi } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { CalendarDays, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function formatDateLabel(date) {
  if (!date) return ''
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function DateRangePicker({ value, onChange, placeholder }) {
  const { t, i18n } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('common.dateRangePlaceholder')
  const dayPickerLocale = i18n.language === 'en' ? enUS : vi
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
    : resolvedPlaceholder

  function handleClear(e) {
    e.stopPropagation()
    onChange(undefined)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'min-w-[180px] justify-start gap-2 font-normal',
          open && 'border-primary',
          !hasValue && 'text-muted-foreground',
        )}
      >
        <CalendarDays size={14} className="shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left">{label}</span>
        {hasValue && (
          <X
            size={13}
            onClick={handleClear}
            className="text-muted-foreground shrink-0 hover:text-foreground"
          />
        )}
      </Button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-50 bg-popover border border-border shadow-lg p-2 rounded-[var(--admin-radius-lg)]">
          <DayPicker
            locale={dayPickerLocale}
            mode="range"
            selected={value}
            onSelect={(range) => {
              onChange(range)
              if (range?.from && range?.to) setOpen(false)
            }}
            disabled={{ after: new Date() }}
            styles={{
              root: {
                '--rdp-accent-color': 'var(--admin-color-brand-red)',
                '--rdp-accent-background-color': 'var(--admin-color-surface-selected)',
                fontFamily: 'inherit',
                fontSize: '0.8125rem',
              },
            }}
          />
          {hasValue && (
            <div className="border-t border-border pt-2 pb-1 px-2 flex justify-end">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer px-1 py-0.5"
              >
                {t('common.dateRangeClear')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
