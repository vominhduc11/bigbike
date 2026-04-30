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
    <div className="pagination">
      <span>
        {t('pagination.items', { count: totalItems })}
        {' · '}
        {t('pagination.page', { page, total: totalPages })}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--admin-space-3)', flexWrap: 'wrap' }}>
        {/* Jump to page — only show when there are more than 3 pages */}
        {totalPages > 3 && (
          <form onSubmit={handleJump} style={{ display: 'flex', alignItems: 'center', gap: 'var(--admin-space-2)' }}>
            <label
              htmlFor="pagination-jump"
              style={{ fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', whiteSpace: 'nowrap' }}
            >
              {t('pagination.jumpTo')}
            </label>
            <input
              id="pagination-jump"
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              className="control-input"
              style={{ width: 64, textAlign: 'center' }}
              aria-label={t('pagination.jumpTo')}
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={!jumpInput}
            >
              →
            </button>
          </form>
        )}

        <div className="pagination-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            {t('pagination.previous')}
          </button>

          {/* Numbered page pills — max 5 visible */}
          {totalPages <= 7 ? (
            Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className="btn btn-secondary"
                onClick={() => onPageChange(p)}
                style={p === page ? {
                  background: 'var(--admin-color-brand-red)',
                  color: '#fff',
                  borderColor: 'var(--admin-color-brand-red)',
                  minWidth: 36,
                } : { minWidth: 36 }}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            ))
          ) : null}

          <button
            type="button"
            className="btn btn-secondary"
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
