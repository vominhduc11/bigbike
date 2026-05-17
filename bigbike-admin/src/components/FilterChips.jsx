import { X } from 'lucide-react'

export function FilterChips({
  chips,
  onClearAll,
  clearAllLabel = 'Xóa tất cả',
  removeChipLabel = 'Xóa bộ lọc',
  ariaLabel,
}) {
  if (!chips || chips.length === 0) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label={ariaLabel}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted py-0.5 pl-2.5 pr-1 text-xs text-foreground"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={chip.removeLabel || removeChipLabel}
            className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-border hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X size={10} aria-hidden="true" />
          </button>
        </span>
      ))}
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-xs px-2 py-0.5 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {clearAllLabel}
        </button>
      )}
    </div>
  )
}
