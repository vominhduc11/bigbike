import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import {
  adjustStock,
  fetchAllMovements,
  fetchInventory,
  fetchInventorySummary,
  fetchVariantMovements,
  inventoryExportCsvUrl,
} from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

const STOCK_STATES = ['ALL', 'IN_STOCK', 'OUT_OF_STOCK', 'LOW_STOCK', 'ON_BACKORDER']
const MOVEMENT_TYPES = ['ADJUSTMENT', 'IN', 'OUT', 'RETURN']

const STOCK_STATE_COLORS = {
  IN_STOCK: '#16a34a',
  LOW_STOCK: '#d97706',
  OUT_OF_STOCK: '#dc2626',
  ON_BACKORDER: '#6b7280',
  UNKNOWN: '#9ca3af',
}

function StockBadge({ state }) {
  const color = STOCK_STATE_COLORS[state] ?? '#9ca3af'
  return (
    <span style={{ color, fontWeight: 600, fontSize: '0.8rem' }}>
      {state?.replace(/_/g, ' ') ?? 'UNKNOWN'}
    </span>
  )
}

function MovementTypeBadge({ type }) {
  const colors = { IN: '#16a34a', OUT: '#dc2626', ADJUSTMENT: '#2563eb', RETURN: '#7c3aed' }
  return (
    <span style={{ color: colors[type] ?? '#6b7280', fontWeight: 600, fontSize: '0.78rem' }}>
      {type}
    </span>
  )
}

function SummaryBanner({ summary }) {
  if (!summary || summary.totalVariants === 0) return null
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
      {summary.outOfStockCount > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 16px' }}>
          <span style={{ color: '#dc2626', fontWeight: 700 }}>{summary.outOfStockCount}</span>
          <span style={{ color: '#dc2626', marginLeft: 6, fontSize: '0.85rem' }}>Hết hàng</span>
        </div>
      )}
      {summary.lowStockCount > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 16px' }}>
          <span style={{ color: '#d97706', fontWeight: 700 }}>{summary.lowStockCount}</span>
          <span style={{ color: '#d97706', marginLeft: 6, fontSize: '0.85rem' }}>Sắp hết hàng</span>
        </div>
      )}
      <div style={{ background: 'var(--admin-color-surface)', border: '1px solid var(--admin-color-border)', borderRadius: 8, padding: '8px 16px' }}>
        <span style={{ fontWeight: 700 }}>{summary.totalVariants}</span>
        <span style={{ marginLeft: 6, fontSize: '0.85rem', color: 'var(--admin-color-text-muted)' }}>Tổng variants</span>
      </div>
    </div>
  )
}

function AdjustModal({ item, onClose, onSuccess }) {
  const [delta, setDelta] = useState('')
  const [type, setType] = useState('ADJUSTMENT')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const d = parseInt(delta, 10)
    if (isNaN(d) || d === 0) { setError('Nhập số khác 0.'); return }
    setSaving(true)
    setError('')
    try {
      const r = await adjustStock(item.variantId, d, type, note)
      toast.success('Đã cập nhật tồn kho')
      onSuccess(r.item)
      onClose()
    } catch (err) {
      setError(err.message || 'Lỗi khi điều chỉnh tồn kho.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Điều chỉnh tồn kho</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '0 24px 8px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--admin-color-text-muted)', marginBottom: 4 }}>
            {item.productName} · <em>{item.variantName}</em>
          </p>
          <p style={{ fontSize: '0.85rem', marginBottom: 16 }}>
            Tồn hiện tại: <strong>{item.quantityOnHand}</strong>
          </p>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="field-label">Số lượng thay đổi *</label>
            <input
              type="number"
              className="control-input"
              placeholder="Dương = thêm, âm = bớt"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="field-label">Loại điều chỉnh</label>
            <select className="control-select" value={type} onChange={(e) => setType(e.target.value)}>
              {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Ghi chú</label>
            <textarea className="control-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="field-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Huỷ</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MovementsModal({ item, onClose }) {
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, status: 'loading' }))
    fetchVariantMovements(item.variantId, { page, pageSize: PAGE_SIZE })
      .then((r) => { if (active) setState({ status: 'success', items: r.items, pagination: r.pagination }) })
      .catch((e) => { if (active) setState({ status: 'error', items: [], pagination: null, error: e.message }) })
    return () => { active = false }
  }, [item.variantId, page])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 720, width: '95vw' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Lịch sử biến động</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '0 24px 8px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--admin-color-text-muted)' }}>
            {item.productName} · <em>{item.variantName}</em>
            {item.variantSku && <span style={{ fontFamily: 'monospace', marginLeft: 6 }}>({item.variantSku})</span>}
          </p>
        </div>
        <div style={{ padding: '0 24px 24px', overflowX: 'auto' }}>
          {state.status === 'error' && <p style={{ color: '#dc2626' }}>{state.error}</p>}
          {state.status === 'success' && state.items.length === 0 && (
            <p style={{ color: 'var(--admin-color-text-muted)' }}>Chưa có biến động nào.</p>
          )}
          {(state.status === 'loading' || state.items.length > 0) && (
            <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                  {['Loại', 'Delta', 'Trước', 'Sau', 'Nguồn', 'Ghi chú', 'Thời gian'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.status === 'loading'
                  ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}><td colSpan={7} style={{ padding: '8px' }}>
                      <div className="skeleton" style={{ height: 14, width: '100%' }} />
                    </td></tr>
                  ))
                  : state.items.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                      <td style={{ padding: '6px 8px' }}><MovementTypeBadge type={m.movementType} /></td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: m.quantityDelta > 0 ? '#16a34a' : '#dc2626' }}>
                        {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                      </td>
                      <td style={{ padding: '6px 8px' }}>{m.quantityBefore}</td>
                      <td style={{ padding: '6px 8px' }}>{m.quantityAfter}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)' }}>{m.referenceType || '—'}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.note || '—'}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)', whiteSpace: 'nowrap' }}>{m.createdAt ? formatDateTime(m.createdAt) : '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {state.status === 'success' && state.pagination && state.pagination.totalPages > 1 && (
            <PaginationControls pagination={state.pagination} onPageChange={setPage} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── All-movements tab ─────────────────────────────────────────────────────────

const INITIAL_MV_QUERY = { page: 1, pageSize: 20, movementType: '', referenceType: '' }

function AllMovementsTab() {
  const [query, setQuery] = useState(INITIAL_MV_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, status: 'loading' }))
    fetchAllMovements(query)
      .then((r) => { if (active) setState({ status: 'success', items: r.items, pagination: r.pagination }) })
      .catch((e) => { if (active) setState({ status: 'error', items: [], pagination: null, error: e.message }) })
    return () => { active = false }
  }, [query])

  const MV_TYPE_OPTIONS = ['', 'IN', 'OUT', 'ADJUSTMENT', 'RETURN']
  const REF_TYPE_OPTIONS = ['', 'ORDER', 'ORDER_CANCEL', 'RETURN', 'MANUAL']

  return (
    <section>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <label>
          Loại biến động
          <select className="control-select" value={query.movementType}
            onChange={(e) => setQuery((q) => ({ ...q, movementType: e.target.value, page: 1 }))}>
            {MV_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t || 'Tất cả'}</option>)}
          </select>
        </label>
        <label>
          Nguồn
          <select className="control-select" value={query.referenceType}
            onChange={(e) => setQuery((q) => ({ ...q, referenceType: e.target.value, page: 1 }))}>
            {REF_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t || 'Tất cả'}</option>)}
          </select>
        </label>
      </div>

      {state.status === 'error' && (
        <StatePanel tone="danger" title="Lỗi tải dữ liệu" description={state.error}
          actionLabel="Thử lại" onAction={() => setQuery((q) => ({ ...q }))} />
      )}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title="Không có dữ liệu" description="Không tìm thấy biến động nào." />
      )}

      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                {['Loại', 'Sản phẩm / Variant', 'Delta', 'Sau', 'Nguồn', 'Ghi chú', 'Thời gian'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.status === 'loading'
                ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}><td colSpan={7} style={{ padding: '8px' }}>
                    <div className="skeleton" style={{ height: 14, width: '100%' }} />
                  </td></tr>
                ))
                : state.items.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                    <td style={{ padding: '6px 8px' }}><MovementTypeBadge type={m.movementType} /></td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ fontWeight: 500 }}>{m.productName || '—'}</span>
                      {m.variantName && <span style={{ color: 'var(--admin-color-text-muted)', marginLeft: 4 }}>· {m.variantName}</span>}
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: m.quantityDelta > 0 ? '#16a34a' : '#dc2626' }}>
                      {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </td>
                    <td style={{ padding: '6px 8px' }}>{m.quantityAfter}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)' }}>{m.referenceType || '—'}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)' }}>{m.note || '—'}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)' }}>{m.createdAt ? formatDateTime(m.createdAt) : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {state.status === 'success' && state.pagination && (
            <PaginationControls pagination={state.pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
          )}
        </>
      )}
    </section>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { q: '', stockState: 'ALL', page: 1, pageSize: 20 }

export function InventoryScreen({ canUpdate }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('stock') // 'stock' | 'movements'
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [adjustItem, setAdjustItem] = useState(null)
  const [movementsItem, setMovementsItem] = useState(null)
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    fetchInventorySummary().then(setSummary)
  }, [])

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    if (activeTab !== 'stock') return
    let active = true
    setState((s) => ({ ...s, status: 'loading' }))
    fetchInventory(query)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [query, activeTab])

  function handleAdjustSuccess(updated) {
    setState((s) => ({
      ...s,
      items: s.items.map((i) => i.variantId === updated.variantId ? updated : i),
    }))
    fetchInventorySummary().then(setSummary)
  }

  const columns = useMemo(() => [
    {
      key: 'product', label: t('inventory.colProduct'), skeletonWidth: '80%',
      render: (item) => (
        <span>
          <p style={{ fontWeight: 500 }}>{item.productName}</p>
          {item.productSku && <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)' }}>{item.productSku}</p>}
        </span>
      ),
    },
    {
      key: 'variant', label: t('inventory.colVariant'), skeletonWidth: '65%',
      render: (item) => (
        <span>
          <p>{item.variantName}</p>
          {item.variantSku && <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', fontFamily: 'monospace' }}>{item.variantSku}</p>}
        </span>
      ),
    },
    {
      key: 'retailPrice', label: t('inventory.colPrice'), align: 'right', skeletonWidth: '55%',
      render: (item) => formatCurrencyVnd(item.retailPrice),
    },
    {
      key: 'stockState', label: t('inventory.colStockState'), skeletonWidth: '50%',
      render: (item) => <StockBadge state={item.stockState} />,
    },
    {
      key: 'quantityOnHand', label: t('inventory.colQty'), align: 'right', skeletonWidth: '30%',
      render: (item) => <strong style={{ fontSize: '1rem' }}>{item.quantityOnHand}</strong>,
    },
    {
      key: 'actions', label: '', align: 'right', skeletonWidth: '60%',
      render: (item) => (
        <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.75rem' }}
            onClick={() => setMovementsItem(item)}>
            Lịch sử
          </button>
          {canUpdate && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem' }}
              onClick={() => setAdjustItem(item)}>
              {t('inventory.adjustBtn')}
            </button>
          )}
        </span>
      ),
    },
  ].filter(Boolean), [canUpdate, t])

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('inventory.eyebrow')}</p>
          <h1>{t('inventory.title')}</h1>
          <p>{t('inventory.description')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={inventoryExportCsvUrl()} className="btn btn-secondary" download>
            Xuất CSV
          </a>
        </div>
      </header>

      <SummaryBanner summary={summary} />

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--admin-color-border)', marginBottom: 20 }}>
        {[['stock', 'Tồn kho'], ['movements', 'Lịch sử biến động']].map(([id, label]) => (
          <button key={id} type="button"
            style={{
              background: 'none', border: 'none', padding: '8px 20px', cursor: 'pointer',
              fontWeight: activeTab === id ? 700 : 400,
              borderBottom: activeTab === id ? '2px solid var(--admin-color-primary)' : '2px solid transparent',
              marginBottom: -2, color: activeTab === id ? 'var(--admin-color-primary)' : 'var(--admin-color-text-muted)',
            }}
            onClick={() => setActiveTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'movements' && <AllMovementsTab />}

      {activeTab === 'stock' && (
        <>
          {state.warning && <ReadOnlyBanner warning={state.warning} />}

          <section className="filter-bar">
            <label>
              {t('common.search')}
              <input type="search" className="control-input"
                placeholder={t('inventory.searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)} />
            </label>
            <label>
              {t('inventory.filterStock')}
              <select className="control-select" value={query.stockState}
                onChange={(e) => setQuery((q) => ({ ...q, stockState: e.target.value, page: 1 }))}>
                {STOCK_STATES.map((s) => (
                  <option key={s} value={s}>{s === 'ALL' ? t('common.all') : s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
          </section>

          {state.status === 'error' && (
            <StatePanel tone="danger" title={t('inventory.loadError')} description={state.error}
              actionLabel={t('common.retry')} onAction={() => setQuery((q) => ({ ...q }))} />
          )}
          {state.status === 'success' && state.items.length === 0 && (
            <StatePanel tone="neutral" title={t('inventory.empty')} description={t('inventory.emptyDesc')} />
          )}
          {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
            <>
              <AdminTable
                caption={t('inventory.tableCaption')}
                columns={columns}
                rows={state.items}
                loading={state.status === 'loading'}
                pageSize={query.pageSize}
              />
              {state.status === 'success' && state.pagination && (
                <PaginationControls pagination={state.pagination}
                  onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
              )}
            </>
          )}
        </>
      )}

      {adjustItem && (
        <AdjustModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSuccess={handleAdjustSuccess}
        />
      )}
      {movementsItem && (
        <MovementsModal
          item={movementsItem}
          onClose={() => setMovementsItem(null)}
        />
      )}
    </section>
  )
}
