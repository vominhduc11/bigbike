import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StatePanel } from '../components/StatePanel'
import { fetchNewsletterSubscribers } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'

const INITIAL_QUERY = { page: 1, pageSize: 20 }

export function NewsletterSubscribersScreen() {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)

  const { status, items, pagination, error, refetch } = useAdminList(
    ['newsletter-subscribers', query],
    () => fetchNewsletterSubscribers(query),
  )

  const rows = items || []

  return (
    <div>
      <div className="screen-header">
        <div>
          <p className="eyebrow">{t('newsletterSubscribers.eyebrow')}</p>
          <h1>{t('newsletterSubscribers.title')}</h1>
          <p className="desc">{t('newsletterSubscribers.description')}</p>
        </div>
      </div>

      {status === 'error' && (
        <StatePanel tone="danger" title={t('newsletterSubscribers.loadError')}
          description={error}
          actionLabel={t('common.retry')} onAction={refetch} />
      )}
      {status === 'success' && rows.length === 0 && (
        <StatePanel tone="neutral" title={t('newsletterSubscribers.empty')}
          description={t('newsletterSubscribers.emptyDesc')} />
      )}

      {(status === 'loading' || (status === 'success' && rows.length > 0)) && (
        <div className="card">
          <div className="card-body card-body--flush">
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('newsletterSubscribers.colEmail')}</th>
                    <th className="num">{t('newsletterSubscribers.colSignedUp')}</th>
                  </tr>
                </thead>
                <tbody>
                  {status === 'loading' && rows.length === 0 && (
                    [...Array(8)].map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={2}><div className="dash-skeleton-block" style={{ height: 28 }} /></td>
                      </tr>
                    ))
                  )}
                  {rows.map((s) => (
                    <tr key={s.id || s.email}>
                      <td className="fw-600">{s.email || '—'}</td>
                      <td className="num muted text-xs">{formatDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {status === 'success' && pagination && pagination.totalPages > 1 && (
            <div className="card-foot">
              <span>
                {t('common.paginationSummary', {
                  defaultValue: `${rows.length} / ${pagination.totalItems}`,
                  count: rows.length,
                  total: pagination.totalItems,
                })}
              </span>
              <div className="pager">
                <button type="button" disabled={pagination.page <= 1} onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}>‹</button>
                <button type="button" className="active">{pagination.page}</button>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}>›</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
