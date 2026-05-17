import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { ExportButton } from '../components/ExportButton'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { exportCustomersCsv, fetchCustomers } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const STATUS_TONES = { ACTIVE: 'success', PENDING: 'warning', DISABLED: 'warning', BLOCKED: 'danger', UNKNOWN: 'muted' }

function CustomerStatusBadge({ value }) {
  const { t } = useTranslation()
  const variant = STATUS_TONES[value] || 'muted'
  return <Badge variant={variant}>{t(`status.customer.${value}`, { defaultValue: value })}</Badge>
}

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 10 }

export function CustomerListScreen({ navigate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)

  const state = useAdminList(['customers', query], () => fetchCustomers(query))

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const columns = useMemo(() => [
    {
      key: 'name', label: t('customers.colCustomer'),
      render: (c) => (
        <div>
          <strong>{formatText(c.fullName)}</strong>
          <p className="text-xs text-muted-foreground">{formatText(c.email)}</p>
        </div>
      ),
    },
    { key: 'phone', label: t('customers.colPhone'), render: (c) => formatText(c.phone) },
    { key: 'status', label: t('customers.colStatus'), render: (c) => <CustomerStatusBadge value={c.status} /> },
    { key: 'orderCount', label: t('customers.colOrders'), render: (c) => c.orderCount },
    { key: 'totalSpent', label: t('customers.colSpent'), render: (c) => formatCurrencyVnd(c.totalSpent) },
    { key: 'createdAt', label: t('customers.colRegistered'), render: (c) => formatDateTime(c.createdAt) },
    {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        <Button variant="outline" onClick={() => navigate(`/admin/customers/${c.id}`)}>{t('customers.viewDetail')}</Button>
      ),
    },
  ], [navigate, t])

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('customers.eyebrow')}</p>
          <h1>{t('customers.title')}</h1>
          <p>{t('customers.description')}</p>
        </div>
        <ExportButton
          label="Xuất CSV"
          filename={`customers_${new Date().toISOString().slice(0,10)}.csv`}
          onExport={() => exportCustomersCsv({ status: query.status !== 'ALL' ? query.status : undefined })}
        />
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <Input type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('customers.searchPlaceholder')}  />
        </label>
        <label>
          {t('customers.filterStatus')}
          <Select value={query.status}
            onValueChange={(val) => updateQuery({ status: val }, { resetPage: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">{t('common.all')}</SelectItem>
            <SelectItem value="ACTIVE">{t('status.customer.ACTIVE')}</SelectItem>
            <SelectItem value="PENDING">{t('status.customer.PENDING')}</SelectItem>
            <SelectItem value="DISABLED">{t('status.customer.DISABLED')}</SelectItem>
            <SelectItem value="BLOCKED">{t('status.customer.BLOCKED')}</SelectItem>
          </SelectContent></Select>
        </label>
      </section>

      {state.status === 'error' && <StatePanel tone="danger" title={t('customers.loadError')} description={state.error} actionLabel={t('common.retry')} onAction={() => state.refetch()} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title={t('customers.empty')} description={t('customers.emptyDesc')} actionLabel={t('common.resetFilters')} onAction={() => { setSearchInput(''); setQuery(INITIAL_QUERY) }} />}
      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('customers.tableCaption')}
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
          />
          {state.status === 'success' && (
            <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
          )}
        </>
      ) : null}
    </section>
  )
}
