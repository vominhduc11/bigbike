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

export function PaginationControls({ pagination, onPageChange }) {
  const { t } = useTranslation()
  const [jumpInput, setJumpInput] = useState('')
  const [jumpError, setJumpError] = useState('')
  const jumpErrId = useId()

  if (!pagination) return null
  const { page, totalPages, totalItems } = pagination
  if (!totalItems) return null

  function handleJump(e) {
    e.preventDefault()
    const target = parseInt(jumpInput, 10)
    // Số trang không hợp lệ (rỗng/không phải số/ngoài khoảng) → báo lỗi rõ, GIỮ lại ô nhập để sửa,
    // không xoá im lặng khiến người dùng tưởng đã nhảy trang.
    if (Number.isNaN(target) || target < 1 || target > totalPages) {
      setJumpError(t('pagination.jumpRange', { total: totalPages, defaultValue: 'Nhập số trang từ 1 đến {{total}}.' }))
      return
    }
    setJumpError('')
    if (target !== page) onPageChange(target)
    setJumpInput('')
  }

  return (
    <div className="bb-table-foot">
      <span className="bb-muted">
        {t('pagination.items', { count: totalItems })}
        {' · '}
        {t('pagination.page', { page, total: totalPages })}
      </span>

      <div className="bb-row flex-wrap">
        {totalPages > 3 && (
          <form onSubmit={handleJump} className="bb-row gap-1.5">
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {t('pagination.jumpTo')}
            </span>
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => { setJumpInput(e.target.value); if (jumpError) setJumpError('') }}
              className="bb-input h-[26px] w-[52px] px-1 text-center text-xs"
              aria-label={t('pagination.jumpTo')}
              aria-invalid={jumpError ? true : undefined}
              aria-describedby={jumpError ? jumpErrId : undefined}
            />
            <Button type="submit" variant="secondary" size="sm" disabled={!jumpInput} aria-label={t('pagination.jumpTo')}>
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
            {jumpError ? (
              <span id={jumpErrId} role="alert" className="bb-field-error whitespace-nowrap">{jumpError}</span>
            ) : null}
          </form>
        )}

        <div className="bb-pagination">
          <Button
            variant="secondary"
            size="sm"
            className="h-7"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            {t('pagination.previous')}
          </Button>

          {buildPageList(page, totalPages).map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="info" aria-hidden="true">…</span>
            ) : (
              <Button
                key={p}
                variant="secondary"
                size="sm"
                className={p === page ? 'active' : ''}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </Button>
            )
          )}

          <Button
            variant="secondary"
            size="sm"
            className="h-7"
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
