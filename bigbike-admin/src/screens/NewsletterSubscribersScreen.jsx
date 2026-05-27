import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Mail } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
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
  const total = pagination?.totalElements ?? null

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('newsletterSubscribers.eyebrow')}</p>
          <h1>{t('newsletterSubscribers.title')}</h1>
          <p className="bb-muted">{t('newsletterSubscribers.description')}</p>
        </div>
        {status === 'success' && rows.length > 0 && (
          <div className="bb-screen-actions">
            <a
              href="/api/admin/newsletter-subscribers/export.csv"
              download
              className="bb-btn bb-btn-secondary"
            >
              <Download size={14} />
              {t('common.export', { defaultValue: 'Xuất CSV' })}
            </a>
          </div>
        )}
      </div>

      {status === 'success' && total !== null && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bb-card">
            <div className="bb-card-body">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-none bg-[var(--bb-brand-subtle)] text-[var(--bb-brand)]">
                  <Mail size={16} />
                </span>
                <div>
                  <div className="text-2xl font-bold" style={{ fontFamily: 'var(--bb-font-display)' }}>
                    {total.toLocaleString('vi-VN')}
                  </div>
                  <div className="bb-muted text-xs">{t('newsletterSubscribers.title')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('newsletterSubscribers.loadError')}
          description={error}
          actionLabel={t('common.retry')}
          onAction={refetch}
        />
      )}

      {status === 'success' && rows.length === 0 && (
        <StatePanel
          tone="neutral"
          title={t('newsletterSubscribers.empty')}
          description={t('newsletterSubscribers.emptyDesc')}
        />
      )}

      {(status === 'loading' || (status === 'success' && rows.length > 0)) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <div className="bb-table-wrap">
              <table className="bb-table" aria-label={t('newsletterSubscribers.tableCaption')}>
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
                      <td className="font-semibold">{s.email || '—'}</td>
                      <td className="num bb-muted text-xs">{formatDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {status === 'success' && pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            />
          )}
        </div>
      )}
    </div>
  )
}
