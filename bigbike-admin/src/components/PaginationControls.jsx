import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Windowed page-number list: always keeps page 1 + the last page visible, a window of
// up to 5 pages around the current one, and 'ellipsis' markers where pages are skipped.
// Ported from bigbike-web/components/ui/PaginationNav.tsx's buildPageList.
function buildPageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = [1]
  if (page > 3) pages.push('ellipsis')
  for (let p = Math.max(2, page - 2); p <= Math.min(totalPages - 1, page + 2); p++) pages.push(p)
  if (page < totalPages - 2) pages.push('ellipsis')
  pages.push(totalPages)
  return pages
}

export function PaginationControls({ pagination, onPageChange, disabled = false }) {
  const { t } = useTranslation()
  const [jumpInput, setJumpInput] = useState('')
  const [jumpError, setJumpError] = useState('')
  const jumpErrId = useId()

  if (!pagination) return null
  const { page, totalPages, totalItems } = pagination
  if (!totalItems) return null

  function handleJump(e) {
    e.preventDefault()
    if (disabled) return
    const target = parseInt(jumpInput, 10)
    // Số trang không hợp lệ (rỗng/không phải số/ngoài khoảng) → báo lỗi rõ, GIỮ lại ô nhập để sửa,
    // không xoá im lặng khiến người dùng tưởng đã nhảy trang.
    if (Number.isNaN(target) || target < 1 || target > totalPages) {
      setJumpError(
        t('pagination.jumpRange', {
          total: totalPages,
          defaultValue: 'Nhập số trang từ 1 đến {{total}}.',
        }),
      )
      return
    }
    setJumpError('')
    if (target !== page) onPageChange(target)
    setJumpInput('')
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-4 text-sm text-muted-foreground"
      aria-busy={disabled || undefined}
    >
      <span>
        {t('pagination.items', { count: totalItems })}
        {' · '}
        {t('pagination.page', { page, total: totalPages })}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        {totalPages > 3 && (
          <form onSubmit={handleJump} className="flex items-center gap-2">
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {t('pagination.jumpTo')}
            </span>
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => {
                setJumpInput(e.target.value)
                if (jumpError) setJumpError('')
              }}
              className="h-9 w-14 px-1 text-center text-sm"
              aria-label={t('pagination.jumpTo')}
              aria-invalid={jumpError ? true : undefined}
              aria-describedby={jumpError ? jumpErrId : undefined}
              disabled={disabled}
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="min-h-11"
              disabled={disabled || !jumpInput}
              aria-label={t('pagination.jumpTo')}
            >
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
            {jumpError ? (
              <span id={jumpErrId} role="alert" className="whitespace-nowrap text-sm text-danger">
                {jumpError}
              </span>
            ) : null}
          </form>
        )}

        <nav
          className="flex flex-wrap items-center gap-1"
          aria-label={t('pagination.page', { page, total: totalPages })}
        >
          <Button
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
          >
            {t('pagination.previous')}
          </Button>

          {buildPageList(page, totalPages).map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="info" aria-hidden="true">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant="secondary"
                size="sm"
                className={
                  p === page
                    ? 'min-h-11 border-primary bg-primary text-primary-foreground'
                    : 'min-h-11'
                }
                onClick={() => onPageChange(p)}
                disabled={disabled}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </Button>
            ),
          )}

          <Button
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= totalPages}
          >
            {t('pagination.next')}
          </Button>
        </nav>
      </div>
    </div>
  )
}
