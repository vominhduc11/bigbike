import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { Modal } from '../components/layout'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchAllSerials, updateSerialStatus, getWarrantyBySerial } from '../lib/adminApi'
import { useAdminList } from '../lib/useAdminList'
import { formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Button } from '@/components/ui/button'
import {
  SERIAL_STATUS_CLASSES,
  SERIAL_ALLOWED_TRANSITIONS,
  NOTE_REQUIRED_STATUSES,
} from '../lib/serialStateMachine'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const ALL_STATUSES = ['ALL', 'IN_STOCK', 'RESERVED', 'SOLD', 'RETURNED', 'INSPECTION', 'DAMAGED', 'SCRAPPED']

// SerialStatusBadge keeps the colour-coded pill style from the original design
// but sources its label from i18n instead of the hardcoded SERIAL_STATUS_LABELS map.
function SerialStatusPill({ status }) {
  const { t } = useTranslation()
  const classes = SERIAL_STATUS_CLASSES[status] ?? 'text-muted-foreground bg-muted'
  const label = t(`serial.status.${status}`, { defaultValue: status })
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN')
}

// ── Warranty panel ────────────────────────────────────────────────────────────

// Fetches warranty for one serial only when its detail modal is open — never for the table.
function SerialWarrantyPanel({ serialId, canRead }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading' })

  // The panel is mounted with key={serialId} by the modal, so each serial gets
  // a fresh component instance starting from the 'loading' initial state — no
  // need to reset state inside the effect.
  useEffect(() => {
    if (!canRead || !serialId) return
    let active = true
    getWarrantyBySerial(serialId)
      .then((w) => { if (active) setState({ status: 'success', warranty: w }) })
      .catch((err) => {
        if (!active) return
        if (err?.status === 404) setState({ status: 'empty' })
        else if (err?.status === 403) setState({ status: 'forbidden' })
        else setState({ status: 'error', error: err?.message || t('serial.warrantyError') })
      })
    return () => { active = false }
  }, [serialId, canRead, t])

  if (!canRead) return null

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-sm font-semibold">{t('serial.warrantyTitle')}</p>
      {state.status === 'loading' && (
        <p className="text-sm text-muted-foreground">{t('serial.warrantyLoading')}</p>
      )}
      {state.status === 'empty' && (
        <p className="text-sm text-muted-foreground">{t('serial.warrantyEmpty')}</p>
      )}
      {state.status === 'forbidden' && (
        <p className="text-sm text-muted-foreground">{t('serial.warrantyForbidden')}</p>
      )}
      {state.status === 'error' && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state.status === 'success' && (
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <div>
            <span className="text-muted-foreground">{t('serial.warrantyStatusLabel')}: </span>
            <StatusBadge type="warranty" status={state.warranty.status} />
          </div>
          <div>
            <span className="text-muted-foreground">{t('serial.warrantyStartLabel')}: </span>
            <span>{formatDate(state.warranty.startDate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('serial.warrantyEndLabel')}: </span>
            <span>{formatDate(state.warranty.endDate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('serial.warrantyEmailLabel')}: </span>
            <span>{state.warranty.customerEmail || '—'}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">{t('serial.warrantyPhoneLabel')}: </span>
            <span>{state.warranty.customerPhone || '—'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Detail modal ──────────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set(['SCRAPPED'])

function SerialDetailModal({ item, onClose, onUpdated, canUpdate, canReadWarranty }) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState(item)
  const [changingStatus, setChangingStatus] = useState(false)
  const [targetStatus, setTargetStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmTerminal, setConfirmTerminal] = useState(false)

  const transitions = SERIAL_ALLOWED_TRANSITIONS[detail.status] ?? []
  const noteRequired = NOTE_REQUIRED_STATUSES.has(targetStatus)

  async function handleStatusChange(e) {
    e.preventDefault()
    if (!targetStatus) return
    if (noteRequired && !statusNote.trim()) {
      setError(t('serial.errorNoteRequired'))
      return
    }
    if (TERMINAL_STATES.has(targetStatus) && !confirmTerminal) {
      setConfirmTerminal(true)
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await updateSerialStatus(detail.id, targetStatus, statusNote.trim() || undefined)
      setDetail(res.item)
      onUpdated(res.item)
      setChangingStatus(false)
      setTargetStatus('')
      setStatusNote('')
      setConfirmTerminal(false)
      toast.success(t('serial.toastStatusChanged', { status: t(`serial.status.${targetStatus}`, { defaultValue: targetStatus }) }))
    } catch (err) {
      setError(err.message || t('serial.errorStatusChange'))
      setConfirmTerminal(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={t('serial.modalTitle')} onClose={onClose}>
        <div className="flex flex-col gap-4">
          {/* Serial number */}
          <div className="bg-surface border border-border p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">{t('serial.modalSerialLabel')}</p>
            <p className="font-mono text-xl font-bold tracking-wide">{detail.serialNumber}</p>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <div>
              <span className="text-muted-foreground">{t('serial.modalProductLabel')}: </span>
              <span className="font-medium">{detail.productName || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('serial.modalVariantLabel')}: </span>
              <span>{detail.variantName || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('serial.modalStatusLabel')}: </span>
              <SerialStatusPill status={detail.status} />
            </div>
            <div>
              <span className="text-muted-foreground">{t('serial.modalReceivedAtLabel')}: </span>
              <span>{formatDate(detail.receivedAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('serial.modalSoldAtLabel')}: </span>
              <span>{formatDate(detail.soldAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('serial.modalReturnedAtLabel')}: </span>
              <span>{formatDate(detail.returnedAt)}</span>
            </div>
            {detail.reservedUntil && (
              <div className="col-span-2">
                <span className="text-muted-foreground">{t('serial.modalReservedUntilLabel')}: </span>
                <span className="text-primary">{formatDateTime(detail.reservedUntil)}</span>
              </div>
            )}
            {detail.note && (
              <div className="col-span-2">
                <span className="text-muted-foreground">{t('serial.modalNoteLabel')}: </span>
                <span>{detail.note}</span>
              </div>
            )}
          </div>

          {/* Warranty */}
          <SerialWarrantyPanel key={detail.id} serialId={detail.id} canRead={canReadWarranty} />

          {/* Status change */}
          {canUpdate && transitions.length > 0 && !changingStatus && (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setChangingStatus(true)}>
              {t('serial.modalChangeStatusBtn')}
            </Button>
          )}

          {canUpdate && changingStatus && (
            <form onSubmit={handleStatusChange} className="flex flex-col gap-2.5 border-t border-border pt-3">
              <p className="text-sm font-semibold">{t('serial.modalChangeStatusTitle')}</p>
              <label className="text-sm">
                {t('serial.modalChangeStatusLabel')}
                <Select value={targetStatus || '__all__'}
                  onValueChange={(val) => { setTargetStatus(val === '__all__' ? '' : val); setError(''); setConfirmTerminal(false) }}
                  required
                ><SelectTrigger><SelectValue placeholder={t('serial.modalChangeStatusPlaceholder')} /></SelectTrigger><SelectContent>
                  {transitions.map((s) => (
                    <SelectItem key={s} value={s}>{t(`serial.status.${s}`, { defaultValue: s })}</SelectItem>
                  ))}
                </SelectContent></Select>
              </label>
              <label className="text-sm">
                {t('serial.modalNoteChangeLabel')} {noteRequired && <span className="text-destructive">*</span>}
                <Input
                  type="text"
                  placeholder={t('serial.modalNotePlaceholder')}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  required={noteRequired}
                />
              </label>
              {confirmTerminal && (
                <div className="bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {t('serial.modalConfirmTerminal', { status: t(`serial.status.${targetStatus}`, { defaultValue: targetStatus }) })}
                </div>
              )}
              {error && <p className="text-destructive text-xs">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={saving} disabled={!targetStatus}>
                  {confirmTerminal ? t('serial.modalConfirmFinal') : t('serial.modalConfirm')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setChangingStatus(false); setTargetStatus(''); setStatusNote(''); setError(''); setConfirmTerminal(false) }}>
                  {t('serial.modalCancel')}
                </Button>
              </div>
            </form>
          )}
        </div>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { q: '', status: 'ALL', page: 1, pageSize: 20 }

export function SerialListScreen({ canUpdate = false, canReadWarranty = false }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [selected, setSelected] = useState(null)

  const state = useAdminList(['serials', query], () => fetchAllSerials(query))

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  function handleUpdated(updatedItem) {
    queryClient.invalidateQueries({ queryKey: ['serials'] })
    setSelected(updatedItem)
  }

  const columns = [
    {
      key: 'serialNumber',
      label: t('serial.colSerialNumber'),
      skeletonWidth: '70%',
      render: (item) => (
        <span className="font-mono font-semibold">{item.serialNumber}</span>
      ),
    },
    {
      key: 'product',
      label: t('serial.colProduct'),
      skeletonWidth: '80%',
      render: (item) => (
        <span>
          <p className="font-medium">{item.productName || '—'}</p>
          {item.variantName && (
            <p className="text-xs text-muted-foreground">{item.variantName}</p>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('serial.colStatus'),
      skeletonWidth: '50%',
      render: (item) => <SerialStatusPill status={item.status} />,
    },
    {
      key: 'receivedAt',
      label: t('serial.colReceivedAt'),
      align: 'right',
      skeletonWidth: '45%',
      render: (item) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(item.receivedAt)}
        </span>
      ),
    },
    {
      key: 'soldAt',
      label: t('serial.colSoldAt'),
      align: 'right',
      skeletonWidth: '45%',
      render: (item) => (
        <span className={`text-xs ${item.soldAt ? 'text-foreground' : 'text-muted-foreground'}`}>
          {formatDate(item.soldAt)}
        </span>
      ),
    },
  ]

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('serial.eyebrow')}</p>
          <h1>{t('serial.title')}</h1>
          <p>{t('serial.description')}</p>
        </div>
      </header>

      <section className="filter-bar">
        <label>
          {t('serial.searchLabel')}
          <Input
            type="search"
            placeholder={t('serial.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
           />
        </label>
        <label>
          {t('serial.filterStatus')}
          <Select
            value={query.status}
            onValueChange={(val) => setQuery((q) => ({ ...q, status: val, page: 1 }))}
          ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'ALL' ? t('common.all') : t(`serial.status.${s}`, { defaultValue: s })}
              </SelectItem>
            ))}
          </SelectContent></Select>
        </label>
      </section>

      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('serial.loadError')}
          description={state.error}
          actionLabel={t('common.retry')}
          onAction={() => state.refetch()}
        />
      )}

      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title={t('serial.empty')} description={t('serial.emptyDesc')} />
      )}

      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <AdminTable
            caption={t('serial.tableCaption')}
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
            onRowClick={(item) => setSelected(item)}
          />
          {state.status === 'success' && state.pagination && (
            <PaginationControls
              pagination={state.pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            />
          )}
        </>
      )}

      {selected && (
        <SerialDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
          canUpdate={canUpdate}
          canReadWarranty={canReadWarranty}
        />
      )}
    </section>
  )
}
