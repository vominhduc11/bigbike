import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { Modal } from '../components/layout'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchWarranties, voidWarranty } from '../lib/adminApi'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { formatDateTime } from '../lib/formatters'
import { Button } from '@/components/ui/button'

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

  function handleVoided() {
    queryClient.invalidateQueries({ queryKey: ['warranties'] })
  }

  const items = state.items || []
  const pagination = state.pagination

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('warranty.eyebrow')}</p>
          <h1>{t('warranty.title')}</h1>
          <p className="bb-muted">{t('warranty.description')}</p>
        </div>
      </div>

      <div className="bb-filter-bar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--bb-text-muted)', pointerEvents: 'none' }} />
          <input
            type="search"
            className="bb-input"
            style={{ paddingLeft: 28 }}
            placeholder={t('warranty.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          className="bb-select"
          value={query.status}
          onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))}
          aria-label={t('warranty.filterStatus')}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? t('warranty.filterStatus') : t(`warranty.status.${s}`, { defaultValue: s })}
            </option>
          ))}
        </select>
      </div>

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('warranty.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
      )}
      {state.status === 'success' && items.length === 0 && (
        <StatePanel tone="neutral" title={t('warranty.empty')} description={t('warranty.emptyDesc')} />
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>{t('warranty.colCustomerEmail')}</th>
                    <th>{t('warranty.colCustomerPhone')}</th>
                    <th>{t('warranty.colStartDate')}</th>
                    <th>{t('warranty.colEndDate')}</th>
                    <th>{t('warranty.colStatus')}</th>
                    <th>{t('warranty.colCreatedAt')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.status === 'loading' && items.length === 0 && (
                    [...Array(8)].map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={7}><div className="dash-skeleton-block" style={{ height: 28 }} /></td>
                      </tr>
                    ))
                  )}
                  {items.map((r) => (
                    <tr key={r.id} onClick={() => setDetailItem(r)}>
                      <td className="text-xs">{r.customerEmail ?? '—'}</td>
                      <td className="text-xs">{r.customerPhone ?? '—'}</td>
                      <td className="text-xs">{formatDate(r.startDate)}</td>
                      <td className="text-xs">{formatDate(r.endDate)}</td>
                      <td><StatusBadge type="warranty" status={r.status} /></td>
                      <td className="bb-muted" style={{ fontSize: 12 }}>{formatDateTime(r.createdAt)}</td>
                      <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={() => setDetailItem(r)}>
                          {t('warranty.viewBtn')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {state.status === 'success' && pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            />
          )}
        </div>
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
    </div>
  )
}
