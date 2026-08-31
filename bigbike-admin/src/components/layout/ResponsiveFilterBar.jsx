import { useState } from 'react'
import { ListFilter, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { FilterBar } from './FilterBar'
import { MobileFilterDrawer } from './MobileFilterDrawer'

/** Một cây filter duy nhất: thanh ngang ở desktop, drawer ở mobile. */
export function ResponsiveFilterBar({
  children,
  className,
  ariaLabel,
  activeFilterCount = 0,
  onReset,
  mobileTitle,
  mobileDescription,
}) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 639px)')
  const [open, setOpen] = useState(false)
  const count = Math.max(0, Number(activeFilterCount) || 0)

  if (!isMobile) {
    return (
      <FilterBar className={className} ariaLabel={ariaLabel}>
        {children}
        {count > 0 && onReset ? (
          <Button type="button" variant="ghost" className="min-h-9" onClick={onReset}>
            <RotateCcw size={16} aria-hidden="true" />
            {t('common.resetFilters')}
          </Button>
        ) : null}
      </FilterBar>
    )
  }

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
          <ListFilter size={16} aria-hidden="true" />
          {mobileTitle || t('common.filters')}
          {count > 0 ? (
            <span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
              {count}
            </span>
          ) : null}
        </Button>
        {count > 0 && onReset ? (
          <Button type="button" variant="ghost" className="min-h-11" onClick={onReset}>
            <RotateCcw size={16} aria-hidden="true" />
            {t('common.resetFilters')}
          </Button>
        ) : null}
      </div>

      <MobileFilterDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={mobileTitle || ariaLabel || t('common.filters')}
        description={
          mobileDescription ||
          (count > 0 ? t('common.filtersApplied', { count }) : t('common.mobileFilterDescription'))
        }
        actions={
          <>
            {count > 0 && onReset ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  onReset()
                  setOpen(false)
                }}
              >
                <RotateCcw size={16} aria-hidden="true" />
                {t('common.resetFilters')}
              </Button>
            ) : null}
            <Button type="button" className="min-h-11" onClick={() => setOpen(false)}>
              {t('common.viewResults')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 [&_button]:w-full [&_input]:w-full [&_[role=combobox]]:w-full">
          {children}
        </div>
      </MobileFilterDrawer>
    </>
  )
}
