import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FilterChips({ chips, onClearAll, clearAllLabel, removeChipLabel, ariaLabel }) {
  const { t } = useTranslation()
  if (!chips || chips.length === 0) return null

  const clearAll =
    clearAllLabel || t('common.clearAllFilters', { defaultValue: 'Xoá tất cả bộ lọc' })
  const removeFallback =
    removeChipLabel || t('common.removeFilterLabel', { defaultValue: 'Xoá bộ lọc' })

  // role="group" để `aria-label` thực sự được trình đọc màn hình đọc lên —
  // aria-label trên <div> trần (không vai trò) bị bỏ qua.
  return (
    <div role="group" className="mb-3 flex flex-wrap items-center gap-2" aria-label={ariaLabel}>
      {chips.map((chip) => {
        // Nếu chip không tự khai báo removeLabel mà nhãn là chuỗi, ghép để aria nói rõ chip nào.
        const removeLabel =
          chip.removeLabel ||
          (typeof chip.label === 'string' ? `${removeFallback}: ${chip.label}` : removeFallback)
        return (
          <span
            key={chip.key}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted py-1 pl-3 pr-1 text-xs text-foreground"
          >
            {chip.label}
            <Button
              variant="unstyled"
              onClick={chip.onRemove}
              aria-label={removeLabel}
              className="-mr-1 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-border hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X size={11} aria-hidden="true" />
            </Button>
          </span>
        )
      })}
      {onClearAll && (
        <Button
          variant="unstyled"
          onClick={onClearAll}
          className="rounded-xs px-2 py-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {clearAll}
        </Button>
      )}
    </div>
  )
}
