import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
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

  const columns = useMemo(() => [
    {
      key: 'email', label: t('newsletterSubscribers.colEmail'), skeletonWidth: '70%',
      render: (s) => <span className="font-medium">{s.email || '—'}</span>,
    },
    {
      key: 'createdAt', label: t('newsletterSubscribers.colSignedUp'), align: 'right', skeletonWidth: '50%',
      render: (s) => <span className="text-xs">{formatDateTime(s.createdAt)}</span>,
    },
  ], [t])

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('newsletterSubscribers.eyebrow')}</p>
          <h1>{t('newsletterSubscribers.title')}</h1>
          <p>{t('newsletterSubscribers.description')}</p>
        </div>
      </header>

      {status === 'error' && (
        <StatePanel tone="danger" title={t('newsletterSubscribers.loadError')}
          description={error}
          actionLabel={t('common.retry')} onAction={refetch} />
      )}
      {status === 'success' && items.length === 0 && (
        <StatePanel tone="neutral" title={t('newsletterSubscribers.empty')}
          description={t('newsletterSubscribers.emptyDesc')} />
      )}
      {(status === 'loading' || (status === 'success' && items.length > 0)) && (
        <>
          <AdminTable
            caption={t('newsletterSubscribers.tableCaption')}
            columns={columns}
            rows={items}
            loading={status === 'loading'}
            pageSize={query.pageSize}
          />
          {status === 'success' && pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            />
          )}
        </>
      )}
    </section>
  )
}
