import { useEffect, useState } from 'react'
import { Modal } from '../../components/layout'
import { PaginationControls } from '../../components/PaginationControls'
import { StatePanel } from '../../components/StatePanel'
import { formatDateTime } from '../../lib/formatters'
import { fetchProductMovements, fetchVariantMovements } from '../../lib/adminApi'
import { MovementTypeBadge } from './shared'

export function MovementHistoryModal({ scope, onClose }) {
  const [query, setQuery] = useState({ page: 1, pageSize: 20 })
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) setState((s) => ({ ...s, status: 'loading' }))
    })
    const promise = scope.scope === 'variant'
      ? fetchVariantMovements(scope.variantId, query)
      : fetchProductMovements(scope.productId, query)
    promise
      .then((r) => { if (active) setState({ status: 'success', items: r.items || [], pagination: r.pagination || null }) })
      .catch((e) => { if (active) setState({ status: 'error', items: [], pagination: null, error: e.message }) })
    return () => { active = false }
  }, [scope, query])

  const title = [scope.productName, scope.variantName].filter(Boolean).join(' · ')

  return (
    <Modal open wide title={`Lịch sử biến động — ${title || '—'}`} onClose={onClose}>
        <div>
          {state.status === 'error' && (
            <StatePanel tone="danger" title="Lỗi tải dữ liệu" description={state.error}
              actionLabel="Thử lại" onAction={() => setQuery((q) => ({ ...q }))} />
          )}
          {state.status === 'success' && state.items.length === 0 && (
            <StatePanel tone="neutral" title="Chưa có biến động"
              description="Sản phẩm này chưa có biến động nào được ghi nhận." />
          )}

          {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {['Loại', 'Biến thể', 'Delta', 'Sau', 'Nguồn', 'Serial', 'Ghi chú', 'Thời gian'].map((h) => (
                        <th key={h} className="text-left py-1.5 px-2 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.status === 'loading'
                      ? Array.from({ length: 6 }, (_, i) => (
                          <tr key={i}><td colSpan={8} className="p-2">
                            <div className="skeleton h-3.5 w-full" />
                          </td></tr>
                        ))
                      : state.items.map((m) => (
                          <tr key={m.id} className="border-b border-border">
                            <td className="py-1.5 px-2"><MovementTypeBadge type={m.movementType} /></td>
                            <td className="py-1.5 px-2">
                              {m.variantName
                                ? <span>{m.variantName}{m.variantSku ? ` · ${m.variantSku}` : ''}</span>
                                : <em className="text-muted-foreground">(Sản phẩm)</em>}
                            </td>
                            <td className={`py-1.5 px-2 font-bold ${m.quantityDelta > 0 ? 'text-success' : 'text-danger'}`}>
                              {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                            </td>
                            <td className="py-1.5 px-2">{m.quantityAfter}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{m.referenceType || '—'}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">
                              {m.serialCount > 0
                                ? <span className="font-mono">{m.serialCount} S/N</span>
                                : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground">{m.note || '—'}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{m.createdAt ? formatDateTime(m.createdAt) : '—'}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
              {state.status === 'success' && state.pagination && state.pagination.totalPages > 1 && (
                <PaginationControls pagination={state.pagination}
                  onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
              )}
            </>
          )}
        </div>
    </Modal>
  )
}
