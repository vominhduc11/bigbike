import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function PaginationControls({ pagination, onPageChange }) {
  const { t } = useTranslation()
  const [jumpInput, setJumpInput] = useState('')

  if (!pagination) return null
  const { page, totalPages, totalItems } = pagination
  if (!totalItems) return null

  function handleJump(e) {
    e.preventDefault()
    const target = parseInt(jumpInput, 10)
    if (!isNaN(target) && target >= 1 && target <= totalPages && target !== page) {
      onPageChange(target)
    }
    setJumpInput('')
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-muted-foreground py-2">
      <span>
        {t('pagination.items', { count: totalItems })}
        {' · '}
        {t('pagination.page', { page, total: totalPages })}
      </span>

      <div className="flex items-center gap-3 flex-wrap">
        {totalPages > 3 && (
          <form onSubmit={handleJump} className="flex items-center gap-2">
            <label
              htmlFor="pagination-jump"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              {t('pagination.jumpTo')}
            </label>
            <Input
              id="pagination-jump"
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              className="w-16 text-center h-7 text-xs"
              aria-label={t('pagination.jumpTo')}
            />
            <Button type="submit" variant="secondary" size="sm" disabled={!jumpInput}>
              →
            </Button>
          </form>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            {t('pagination.previous')}
          </Button>

          {totalPages <= 7
            ? Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className="min-w-[32px]"
                >
                  {p}
                </Button>
              ))
            : null}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            {t('pagination.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
