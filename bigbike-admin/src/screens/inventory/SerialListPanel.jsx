import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { PaginationControls } from '../../components/PaginationControls'
import { showConfirm } from '../../lib/confirm'
import { formatDateTime } from '../../lib/formatters'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_ALLOWED_TRANSITIONS,
  NOTE_REQUIRED_STATUSES,
} from '../../lib/serialStateMachine'
import { fetchVariantSerials, fetchProductSerials, updateSerialStatus } from '../../lib/adminApi'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { SerialStatusBadge } from './shared'
import { SerialQrModal } from './SerialQrModal'

export function SerialListPanel({ item, refreshKey }) {
  const isVariant = Boolean(item?.variantId)
  const [query, setQuery] = useState({ page: 1, pageSize: 20, status: '' })
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })
  const [statusChangeId, setStatusChangeId] = useState(null)
  const [statusChangeValue, setStatusChangeValue] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [changing, setChanging] = useState(false)
  const [qrSerial, setQrSerial] = useState(null)

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, status: 'loading' }))
    const fetch = isVariant
      ? fetchVariantSerials(item.variantId, query)
      : fetchProductSerials(item.productId, query)
    fetch.then((data) => {
      if (!active) return
      setState({ status: 'success', items: data.items || [], pagination: data.pagination || null })
    }).catch((err) => {
      if (!active) return
      setState({ status: 'error', items: [], pagination: null, error: err.message })
    })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, query, refreshKey])

  async function handleStatusChange(serialId) {
    if (!statusChangeValue) return
    if (NOTE_REQUIRED_STATUSES.has(statusChangeValue) && !statusNote.trim()) {
      toast.error('Lý do bắt buộc khi chuyển sang trạng thái ' + (SERIAL_STATUS_LABELS[statusChangeValue] ?? statusChangeValue) + '.')
      return
    }
    // SCRAPPED is terminal — require explicit confirmation, consistent with
    // the serial detail modal in SerialListScreen.
    if (statusChangeValue === 'SCRAPPED') {
      const ok = await showConfirm(
        'Chuyển serial sang trạng thái Đã hủy?\n\nTrạng thái này không thể hoàn tác.',
        'Xác nhận hủy serial',
      )
      if (!ok) return
    }
    setChanging(true)
    try {
      const res = await updateSerialStatus(serialId, statusChangeValue, statusNote.trim() || undefined)
      setState((s) => ({
        ...s,
        items: s.items.map((i) => i.id === serialId ? res.item : i),
      }))
      toast.success(`Đã chuyển serial sang ${SERIAL_STATUS_LABELS[statusChangeValue] ?? statusChangeValue}.`)
      setStatusChangeId(null)
      setStatusChangeValue('')
      setStatusNote('')
    } catch (err) {
      toast.error(err.message || 'Lỗi cập nhật trạng thái.')
    } finally {
      setChanging(false)
    }
  }

  if (state.status === 'error') {
    return <p className="text-destructive text-xs">Lỗi: {state.error}</p>
  }

  return (
    <>
      <div className="flex gap-2 mb-3 items-center">
        <label className="text-xs">
          Lọc trạng thái:
          <Select className="ml-1.5" value={(query.status) || '__all__'}
            onValueChange={(val) => { const v = val === '__all__' ? '' : val; setQuery((q) => ({ ...q, status: v, page: 1 })) }}><SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger><SelectContent>
            <SelectItem value="__all__">Tất cả trạng thái</SelectItem>
            {Object.keys(SERIAL_STATUS_LABELS).map((s) => (
              <SelectItem key={s} value={s}>{SERIAL_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent></Select>
        </label>
      </div>

      {state.status === 'loading' && (
        <p className="text-xs text-muted-foreground">Đang tải…</p>
      )}

      {state.status === 'success' && state.items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Chưa có serial nào{query.status ? ` với trạng thái "${SERIAL_STATUS_LABELS[query.status] || query.status}"` : ''}.
        </p>
      )}

      {state.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Mã serial', 'Trạng thái', 'Nhập kho', 'Thao tác'].map((h) => (
                  <th key={h} className="text-left py-1.5 px-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.items.map((s) => {
                const isChanging = statusChangeId === s.id
                const allowedTo = SERIAL_ALLOWED_TRANSITIONS[s.status] || []
                return (
                  <tr key={s.id} className="border-b border-border">
                    <td className="py-1.5 px-2 font-mono">{s.serialNumber || '—'}</td>
                    <td className="py-1.5 px-2"><SerialStatusBadge status={s.status} /></td>
                    <td className="py-1.5 px-2 text-muted-foreground">
                      {s.receivedAt ? formatDateTime(s.receivedAt) : '—'}
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex gap-1 items-center flex-wrap">
                        {/* QR button — always visible */}
                        <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm"
                          title="Xem mã QR"
                          onClick={() => setQrSerial(s)}>
                          QR
                        </button>

                        {/* Status change */}
                        {allowedTo.length > 0 && !isChanging && (
                          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm"
                            onClick={() => { setStatusChangeId(s.id); setStatusChangeValue('') }}>
                            Đổi trạng thái
                          </button>
                        )}
                        {isChanging && (
                          <div className="flex flex-col gap-1">
                            <Select value={(statusChangeValue) || '__all__'}
                              onValueChange={(val) => setStatusChangeValue(val === '__all__' ? '' : val)} disabled={changing}><SelectTrigger><SelectValue placeholder="-- Chọn --" /></SelectTrigger><SelectContent>
                              {allowedTo.map((st) => (
                                <SelectItem key={st} value={st}>{SERIAL_STATUS_LABELS[st] || st}</SelectItem>
                              ))}
                            </SelectContent></Select>
                            {statusChangeValue === 'SCRAPPED' && (
                              <p className="text-destructive text-xs">Cảnh báo: trạng thái Đã hủy không thể hoàn tác.</p>
                            )}
                            <Input
                              placeholder={NOTE_REQUIRED_STATUSES.has(statusChangeValue) ? 'Lý do (bắt buộc)' : 'Ghi chú (tuỳ chọn)'}
                              value={statusNote} onChange={(e) => setStatusNote(e.target.value)}
                              disabled={changing}
                              required={NOTE_REQUIRED_STATUSES.has(statusChangeValue)} />
                            <div className="flex gap-1">
                              <button type="button" className="bb-btn bb-btn-primary bb-btn-sm"
                                onClick={() => handleStatusChange(s.id)}
                                disabled={changing || !statusChangeValue}>
                                {changing ? '…' : 'Xác nhận'}
                              </button>
                              <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm"
                                onClick={() => { setStatusChangeId(null); setStatusChangeValue(''); setStatusNote('') }}
                                disabled={changing}>
                                Huỷ
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {state.pagination && state.pagination.totalPages > 1 && (
        <PaginationControls pagination={state.pagination}
          onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
      )}

      {qrSerial && (
        <SerialQrModal serial={qrSerial} onClose={() => setQrSerial(null)} />
      )}
    </>
  )
}
