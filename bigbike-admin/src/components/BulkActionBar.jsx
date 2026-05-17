import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function BulkActionBar({ selectedCount, onClear, actions = [], closeLabel = 'Clear selection' }) {
  if (!selectedCount) return null

  return (
    <div className="sticky top-0 z-10 mb-3 flex items-center gap-3 rounded-xs bg-primary px-4 py-2.5 text-primary-foreground shadow-md">
      <span className="flex-1 text-sm font-bold">{selectedCount}</span>
      <div className="flex gap-1.5">
        {actions.map((action, index) => (
          <Button
            key={index}
            type="button"
            size="sm"
            variant={action.tone === 'danger' ? 'danger' : 'ghost'}
            className={cn(
              'border border-white/30 text-white',
              action.tone === 'danger'
                ? 'hover:opacity-80'
                : 'bg-white/15 hover:bg-white/25',
            )}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        ))}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="border border-white/30 bg-white/15 text-white hover:bg-white/25"
          onClick={onClear}
          aria-label={closeLabel}
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  )
}
