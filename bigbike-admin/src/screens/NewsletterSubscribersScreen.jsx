import { useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { fetchNewsletterSubscribers } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'

const INITIAL_QUERY = { page: 1, pageSize: 20 }

export function NewsletterSubscribersScreen() {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })

  useEffect(() => {
    let active = true
    fetchNewsletterSubscribers(query)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, pagination: r.pagination })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, error: e.message })
      })
    return () => { active = false }
  }, [query])

  const columns = useMemo(() => [
    {
      key: 'email', label: 'Email', skeletonWidth: '70%',
      render: (s) => <span className="font-medium">{s.email || '—'}</span>,
    },
    {
      key: 'createdAt', label: 'Ngày đăng ký', align: 'right', skeletonWidth: '50%',
      render: (s) => <span className="text-xs">{formatDateTime(s.createdAt)}</span>,
    },
  ], [])

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Marketing</p>
          <h1>Email đăng ký nhận tin</h1>
          <p>Danh sách email khách đăng ký qua ô đăng ký ở chân trang website.</p>
        </div>
      </header>

      {state.status === 'error' && (
        <StatePanel tone="danger" title="Không tải được danh sách"
          description={state.error}
          actionLabel="Thử lại" onAction={() => setQuery((q) => ({ ...q }))} />
      )}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title="Chưa có email đăng ký"
          description="Email khách đăng ký nhận tin sẽ hiển thị ở đây." />
      )}
      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <AdminTable
            caption="Danh sách email đăng ký nhận tin"
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
          />
          {state.status === 'success' && state.pagination && (
            <PaginationControls
              pagination={state.pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            />
          )}
        </>
      )}
    </section>
  )
}
