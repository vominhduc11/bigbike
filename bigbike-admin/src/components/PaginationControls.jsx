import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
    <div className="bb-table-foot">
      <span className="bb-muted">
        {t('pagination.items', { count: totalItems })}
        {' · '}
        {t('pagination.page', { page, total: totalPages })}
      </span>

      <div className="bb-row">
        {totalPages > 3 && (
          <form onSubmit={handleJump} className="bb-row" style={{ gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--bb-text-muted)', whiteSpace: 'nowrap' }}>
              {t('pagination.jumpTo')}
            </span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              className="bb-input"
              style={{ width: 52, height: 26, fontSize: 12, textAlign: 'center' }}
              aria-label={t('pagination.jumpTo')}
            />
            <button type="submit" className="bb-btn bb-btn-secondary bb-btn-sm" disabled={!jumpInput}>
              →
            </button>
          </form>
        )}

        <div className="bb-pagination">
          <button
            className="bb-btn bb-btn-secondary bb-btn-sm"
            style={{ height: 28 }}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            {t('pagination.previous')}
          </button>

          {totalPages <= 7
            ? Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={p === page ? 'active' : ''}
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              ))
            : null}

          <button
            className="bb-btn bb-btn-secondary bb-btn-sm"
            style={{ height: 28 }}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            {t('pagination.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
