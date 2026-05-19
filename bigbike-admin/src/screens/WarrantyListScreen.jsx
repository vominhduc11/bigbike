import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { Modal } from '../components/layout'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchWarranties, voidWarranty } from '../lib/adminApi'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { formatDateTime } from '../lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const STATUSES = ['ALL', 'ACTIVE', 'EXPIRED', 'VOIDED']

function formatDate(isoDate) {
  if (!isoDate) return '—'
  return new Date(isoDate).toLocaleDateString('vi-VN')
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function WarrantyDetailModal({ item, onClose, onVoided, canUpdate }) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState(item)
  const [voiding, setVoiding] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')

  async function handleVoid() {
    setVoiding(true)
    setError('')
    try {
      const updated = await voidWarranty(detail.id)
      setDetail(updated)
      onVoided(updated)
      setConfirm(false)
      toast.success(t('warranty.toastVoided'))
    } catch (err) {
      setError(err.message || t('warranty.errorVoid'))
    } finally {
      setVoiding(false)
    }
  }

  return (
    <Modal open title={t('warranty.modalTitle')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <div>
            <span className="text-muted-foreground">{t('warranty.modalStatusLabel')}: </span>
            <StatusBadge type="warranty" status={detail.status} />
          </div>
          <div>
            <span className="text-muted-foreground">{t('warranty.modalCreatedAtLabel')}: </span>
            <span>{formatDateTime(detail.createdAt)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('warranty.modalCustomerEmail')}: </span>
            <span>{detail.customerEmail ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('warranty.modalCustomerPhone')}: </span>
            <span>{detail.customerPhone ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('warranty.modalStartDate')}: </span>
            <span>{formatDate(detail.startDate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('warranty.modalEndDate')}: </span>
            <span>{formatDate(detail.endDate)}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">{t('warranty.modalSerialId')}: </span>
            <span className="font-mono text-xs">{detail.serialId}</span>
          </div>
        </div>

        {canUpdate && detail.status !== 'VOIDED' && (
          <div className="border-t border-border pt-4">
            {!confirm ? (
              <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
                {t('warranty.modalVoidBtn')}
              </Button>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-sm text-destructive m-0">
                  {t('warranty.modalVoidConfirmText')}
                </p>
                {error && <p className="field-error">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirm(false)} disabled={voiding}>
                    {t('warranty.modalVoidNo')}
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleVoid} disabled={voiding}>
                    {voiding ? t('warranty.modalVoiding') : t('warranty.modalVoidConfirm')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { status: 'ALL', q: '', page: 1, pageSize: 20 }

export function WarrantyListScreen({ canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [detailItem, setDetailItem] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearch = useRef(true)

  useEffect(() => {
    if (isFirstSearch.current) { isFirstSearch.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const state = useAdminList(['warranties', query], () => fetchWarranties(query))

  const columns = useMemo(() => [
    {
      key: 'customerEmail', label: t('warranty.colCustomerEmail'), skeletonWidth: '70%',
      render: (r) => <span className="text-xs">{r.customerEmail ?? '—'}</span>,
    },
    {
      key: 'customerPhone', label: t('warranty.colCustomerPhone'), skeletonWidth: '50%',
      render: (r) => <span className="text-xs">{r.customerPhone ?? '—'}</span>,
    },
    {
      key: 'startDate', label: t('warranty.colStartDate'), skeletonWidth: '45%',
      render: (r) => formatDate(r.startDate),
    },
    {
      key: 'endDate', label: t('warranty.colEndDate'), skeletonWidth: '45%',
      render: (r) => formatDate(r.endDate),
    },
    {
      key: 'status', label: t('warranty.colStatus'), skeletonWidth: '40%',
      render: (r) => <StatusBadge type="warranty" status={r.status} />,
    },
    {
      key: 'createdAt', label: t('warranty.colCreatedAt'), skeletonWidth: '55%',
      render: (r) => <span className="text-xs">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right', skeletonWidth: '40%',
      render: (r) => (
        <Button variant="outline" size="sm" onClick={() => setDetailItem(r)}>
          {t('warranty.viewBtn')}
        </Button>
      ),
    },
  ], [t])

  function handleVoided() {
    queryClient.invalidateQueries({ queryKey: ['warranties'] })
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('warranty.eyebrow')}</p>
          <h1>{t('warranty.title')}</h1>
          <p>{t('warranty.description')}</p>
        </div>
      </header>

      <section className="filter-bar">
        <label>
          {t('warranty.searchLabel')}
          <Input
            type="search"
            placeholder={t('warranty.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
        <label>
          {t('warranty.filterStatus')}
          <Select value={query.status}
            onValueChange={(val) => setQuery((q) => ({ ...q, status: val, page: 1 }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'ALL' ? t('common.all') : t(`warranty.status.${s}`, { defaultValue: s })}
              </SelectItem>
            ))}
          </SelectContent></Select>
        </label>
      </section>

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('warranty.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
      )}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title={t('warranty.empty')} description={t('warranty.emptyDesc')} />
      )}
      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <AdminTable
            caption={t('warranty.tableCaption')}
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

      {detailItem && (
        <WarrantyDetailModal
          key={detailItem.id}
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onVoided={handleVoided}
          canUpdate={canUpdate}
        />
      )}
    </section>
  )
}
