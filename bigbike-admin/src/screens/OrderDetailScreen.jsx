import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { AlertCircle, ArrowRight, ChevronRight, Package } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { MobileCardList, MobileCard } from '../components/layout/MobileCardList'
import { addOrderNote, fetchOrderAllowedTransitions, fetchOrderAuditTrail, fetchOrderDetail, updateOrderStatus } from '../lib/adminApi'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { ORDER_STATUS_TONE } from '../lib/statusTone'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'
import { recordRecentItem } from '../lib/useRecentItems'
import { useAdminPresence } from '../lib/useAdminPresence'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  REASON_REQUIRED, addressLine, sameAddress,
  ORDER_STATUS_ACTION, getOrderStatusLabel,
} from './order-detail/constants'
import { ReasonConfirmModal } from './order-detail/ReasonConfirmModal'

// T9: đọc lại query string (filter/sort/trang) mà OrderListScreen đã lưu trước khi
// điều hướng sang trang chi tiết, để nút "Quay lại danh sách" không làm mất bộ lọc.
function readListQuery() {
  try {
    return sessionStorage.getItem('orders:listQuery') || ''
  } catch {
    return ''
  }
}

// N5: khung skeleton phỏng theo bố cục thật (header + action panel + 2 cột card)
// để tránh dịch chuyển layout (CLS) khi dữ liệu đơn hàng về — cùng cách làm với
// DashboardScreen.jsx (SkeletonBlock).
function SkeletonBlock({ height }) {
  return <div className="bb-skeleton-block" style={{ height }} />
}

function OrderDetailSkeleton() {
  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title bb-stack-xs">
          <SkeletonBlock height={28} />
          <SkeletonBlock height={16} />
        </div>
      </div>
      <div className="mb-4"><SkeletonBlock height={84} /></div>
      <div className="bb-grid-2-1">
        <div className="bb-stack">
          <SkeletonBlock height={220} />
          <SkeletonBlock height={140} />
          <SkeletonBlock height={140} />
        </div>
        <div className="bb-stack">
          <SkeletonBlock height={180} />
          <SkeletonBlock height={160} />
          <SkeletonBlock height={140} />
        </div>
      </div>
    </div>
  )
}

function OrderItemThumbnail({ item }) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = item.productThumbnailUrl

  return (
    <span className="bb-product-thumb" aria-hidden="true">
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : <Package className="size-4" />}
    </span>
  )
}

export function OrderDetailScreen({ orderId, navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { hasOtherAdmin } = useAdminPresence('order', orderId)
  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrderDetail(orderId),
  })
  const auditQuery = useQuery({
    queryKey: ['order-audit', orderId],
    queryFn: () => fetchOrderAuditTrail(orderId),
    enabled: Boolean(orderId),
  })

  // Live-refresh khi đơn ĐANG XEM có thay đổi (trạng thái/thanh toán/note/refund) đẩy về
  // qua WebSocket admin. Chỉ refetch khi event đúng orderId này — tránh refetch thừa.
  useEffect(() => {
    const unsubscribe = subscribeAdminWs('/topic/admin/orders', (event) => {
      if (String(event?.orderId) === String(orderId)) {
        queryClient.invalidateQueries({ queryKey: ['order', orderId] })
        queryClient.invalidateQueries({ queryKey: ['order-audit', orderId] })
      }
    })
    return unsubscribe
  }, [orderId, queryClient])

  const order = orderQuery.data?.item ?? null
  const warning = ''
  const status = orderQuery.isLoading ? 'loading' : orderQuery.isError ? 'error' : 'success'

  const [saving, setSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [allowedTransitions, setAllowedTransitions] = useState([])
  const [transitionsError, setTransitionsError] = useState(false)
  const [transitionsKey, setTransitionsKey] = useState(0)
  const [noteContent, setNoteContent] = useState('')
  const [noteCustomerVisible, setNoteCustomerVisible] = useState(false)
  const [submittingNote, setSubmittingNote] = useState(false)
  const [showShipForm, setShowShipForm] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingError, setTrackingError] = useState('')
  const [shippingCarrier, setShippingCarrier] = useState('')
  const [reasonModal, setReasonModal] = useState(null)

  // F6: cảnh báo rời trang khi đang gõ dở ghi chú hoặc form giao hàng chưa lưu.
  useUnsavedChanges(!!noteContent.trim() || showShipForm)

  // O9: ghi lại đơn hàng vừa xem để hiện trong widget "Vừa xem gần đây".
  useEffect(() => {
    if (order?.id) {
      recordRecentItem('recent:orders', { id: order.id, label: formatText(order.orderNumber, `#${order.id}`) })
    }
  }, [order?.id, order?.orderNumber])

  function applyOrderUpdate(updatedOrder) {
    queryClient.setQueryData(['order', orderId], (old) => ({ ...old, item: updatedOrder }))
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['order-audit', orderId] })
  }

  useEffect(() => {
    if (!orderQuery.isSuccess || !order?.orderStatus) return undefined
    let active = true
    fetchOrderAllowedTransitions(orderId)
      .then((response) => {
        if (!active) return
        setAllowedTransitions(response.transitions || [])
        setTransitionsError(false)
      })
      .catch(() => {
        if (!active) return
        setAllowedTransitions([])
        setTransitionsError(true)
      })
    return () => { active = false }
  }, [orderId, orderQuery.isSuccess, order?.orderStatus, transitionsKey])

  async function doStatusChange(newStatus, reason, shipping) {
    setSaving(true)
    setPendingAction(`status:${newStatus}`)
    try {
      const response = await updateOrderStatus(orderId, newStatus, reason, shipping)
      const updatedOrder = response.item
      applyOrderUpdate(updatedOrder)
      toast.success(t('orders.detail.statusUpdated'))
      return true
    } catch (err) {
      toast.error(err.message || t('orders.detail.updateStatusError'))
      return false
    } finally {
      setSaving(false)
      setPendingAction(null)
    }
  }

  async function handleStatusChange(newStatus) {
    if (REASON_REQUIRED.has(newStatus)) {
      setReasonModal({ targetStatus: newStatus })
      return
    }
    if (newStatus === 'SHIPPING') {
      setShowShipForm(true)
      return
    }
    if (newStatus === 'COMPLETED') {
      const labelKeys = { COMPLETED: 'orders.detail.dangerCompleted' }
      const label = labelKeys[newStatus] ? t(labelKeys[newStatus]) : newStatus
      const confirmed = await showConfirm(
        t('orders.detail.confirmStatusMessage', { label }),
        t('orders.detail.confirmStatusTitle')
      )
      if (!confirmed) return
    }
    await doStatusChange(newStatus, undefined)
  }

  async function handleAddNote(e) {
    e.preventDefault()
    if (!noteContent.trim()) return
    setSubmittingNote(true)
    try {
      const note = await addOrderNote(orderId, { content: noteContent.trim(), customerVisible: noteCustomerVisible })
      queryClient.setQueryData(['order', orderId], (old) => ({
        ...old,
        item: { ...old.item, notes: [...(old.item.notes ?? []), note] },
      }))
      setNoteContent('')
      setNoteCustomerVisible(false)
      toast.success(t('orders.detail.noteAdded'))
    } catch (err) {
      toast.error(err.message || t('orders.detail.noteError'))
    } finally {
      setSubmittingNote(false)
    }
  }

  async function handleShippingSubmit(e) {
    e.preventDefault()
    if (!trackingNumber.trim()) {
      setTrackingError(t('orders.detail.trackingRequiredError'))
      return
    }
    setTrackingError('')
    const ok = await doStatusChange('SHIPPING', undefined, {
      trackingNumber: trackingNumber.trim(),
      shippingCarrier: shippingCarrier.trim() || undefined,
    })
    if (ok) {
      setShowShipForm(false)
      setTrackingNumber('')
      setShippingCarrier('')
      setTrackingError('')
    }
  }

  if (status === 'loading') {
    return <OrderDetailSkeleton />
  }
  if (status === 'error') {
    return <StatePanel tone="danger" title={t('orders.detail.loadError')}
      description={t('orders.detail.loadErrorDesc', { defaultValue: 'Không thể tải chi tiết đơn hàng. Vui lòng thử lại.' })}
      actionLabel={t('common.retry')} onAction={() => orderQuery.refetch()} />
  }
  if (!order) {
    return <StatePanel tone="neutral" title={t('orders.detail.notFound')} description={`ID: ${orderId}`}
      actionLabel={t('common.back')} onAction={() => navigate('/admin/orders')} />
  }

  const trackingSummary = order.trackingNumber
    ? t('orders.detail.tileTrackingNumber', {
      tracking: `${order.shippingCarrier ? `${order.shippingCarrier} · ` : ''}${order.trackingNumber}`,
    })
    : t('orders.detail.tileTrackingPending')
  const shippingReference = [order.shippingCarrier, order.trackingNumber].filter(Boolean).join(' · ')

  // Khoá các nút chuyển trạng thái khi đang lưu HOẶC đang làm mới nền (dữ liệu/allowed
  // transitions có thể sắp thay) — tránh thao tác dựa trên trạng thái cũ.
  const actionsBusy = saving || orderQuery.isFetching

  // T18: 3 nhóm hành động trong vùng "Việc cần làm tiếp" — tách rõ để khi CẢ BA đều
  // rỗng (vd đơn đã hủy/hoàn thành) hiện trạng thái "quiet" thay vì khối cảnh báo to.
  const orderProgressTransitions = allowedTransitions.filter((status) => status !== 'CANCELLED')
  const hasOrderGroup = orderProgressTransitions.length > 0 || transitionsError
  const canCancelOrder = allowedTransitions.includes('CANCELLED')
  const hasAnyAction = hasOrderGroup || canCancelOrder
  const hasShippingDetails = Boolean(shippingReference || order.shippedAt)

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <h1 className="bb-heading-inline">
            {t('orders.detail.eyebrow')}{' '}
            <span className="mono bb-heading-key">
              {formatText(order.orderNumber, `#${orderId}`)}
            </span>
          </h1>
          <p className="bb-muted">
            {t('orders.detail.orderDate')} {formatDateTime(order.createdAt)}
            {' · '}{t('orders.detail.paymentMethod')} <span className="mono">{t(`status.paymentMethod.${order.paymentMethod}`, { defaultValue: formatText(order.paymentMethod) })}</span>
          </p>
        </div>
        <div className="bb-screen-actions">
          <Button type="button" variant="secondary" onClick={() => navigate(`/admin/orders${readListQuery()}`)}>
            {t('orders.detail.backToList')}
          </Button>
        </div>
      </div>

      {warning && <ReadOnlyBanner warning={warning} />}

      {hasOtherAdmin ? (
        <Alert tone="warning" size="sm" className="mb-4">
          {t('presence.otherAdminOrder', { defaultValue: 'Có quản trị viên khác đang mở đơn này. Hãy kiểm tra dữ liệu trước khi lưu.' })}
        </Alert>
      ) : null}

      {/* Tầng 1 — dải trạng thái (trái) + việc cần làm tiếp (phải): toàn cảnh đơn
          hàng trong 1 lần nhìn, thay vì 3 khối trạng thái rời + panel hành động
          full-width như trước. */}
      {(() => {
        const tiles = (
          <div className="bb-status-tiles bb-status-tiles--2">
            <div className={`bb-status-tile bb-status-tile--${ORDER_STATUS_TONE[order.orderStatus] ?? 'muted'}`}>
              <div className="bb-status-tile-k">{t('orders.detail.tileOrder')}</div>
              <StatusBadge type="order" status={order.orderStatus} />
              <div className="bb-cell-sub">{t('orders.detail.tileOrderDate', { date: formatDateTime(order.placedAt) })}</div>
            </div>
            <div className="bb-status-tile bb-status-tile--muted">
              <div className="bb-status-tile-k">{t('orders.detail.tileShipping')}</div>
              <div className="bb-cell-sub">{trackingSummary}</div>
            </div>
          </div>
        )

        if (!canUpdate) return tiles

        return (
          <div className="bb-status-summary">
            {tiles}
            <div className="bb-actionzone">
              {!hasAnyAction ? (
                <div className="bb-actionzone-quiet">
                  <span className="dot" aria-hidden="true" />
                  {t('orders.detail.noActionQuiet')}
                </div>
              ) : (
                <>
                  <div className="bb-actionzone-title">{t('orders.detail.nextActions')}</div>

                  {hasOrderGroup && (
                    <div className="bb-actionzone-group">
                      <div className="bb-actionzone-group-label">{t('orders.detail.orderStatus')}</div>
                      <div className="bb-actionzone-actions">
                        {orderProgressTransitions.map((status) => {
                          const cfg = ORDER_STATUS_ACTION[status] ?? { variant: 'secondary' }
                          const isPrimary = cfg.variant === 'primary' || cfg.variant === 'success'
                          const isPending = pendingAction === `status:${status}`
                          return (
                            <Button
                              key={status}
                              type="button"
                              variant={isPrimary ? 'default' : 'secondary'}
                              disabled={actionsBusy}
                              onClick={() => handleStatusChange(status)}
                            >
                              {isPending ? t('orders.detail.savingShort') : <><ArrowRight size={14} aria-hidden="true" />{getOrderStatusLabel(status, order, t)}</>}
                            </Button>
                          )
                        })}
                        {transitionsError && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setTransitionsKey((key) => key + 1)}>
                            {t('common.retry')}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {canCancelOrder && (
                    <div className="bb-actionzone-group">
                      <div className="bb-actionzone-group-label">{t('orders.detail.otherActions')}</div>
                      <div className="bb-actionzone-actions">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-danger"
                          disabled={actionsBusy}
                          onClick={() => handleStatusChange('CANCELLED')}
                        >
                          {pendingAction === 'status:CANCELLED'
                            ? t('orders.detail.savingShort')
                            : getOrderStatusLabel('CANCELLED', order, t)}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Form nhập vận đơn — mở ngay tại khu hành động khi bấm "Giao hàng" (không phải cuộn xuống) */}
                  {showShipForm && order.orderStatus === 'PROCESSING' && (
                    <div className="bb-actionzone-group">
                      <form
                        id="ship-form"
                        className="bb-detail-form w-full"
                        onSubmit={handleShippingSubmit}
                      >
                        <div className="flex flex-col gap-1">
                          <label htmlFor="ship-tracking-input" className="text-sm font-medium">
                            {t('orders.detail.trackingLabel')} *
                          </label>
                          <p className="text-xs text-muted-foreground">
                            <span className="text-danger" aria-hidden="true">*</span> {t('common.requiredLegend', { defaultValue: 'Bắt buộc' })}
                          </p>
                          <Input
                            id="ship-tracking-input"
                            type="text"
                            placeholder={t('orders.detail.trackingPlaceholder')}
                            value={trackingNumber}
                            onChange={(e) => { setTrackingNumber(e.target.value); if (trackingError) setTrackingError('') }}
                            onBlur={() => { if (!trackingNumber.trim()) setTrackingError(t('orders.detail.trackingRequiredError')) }}
                            disabled={saving}
                            required
                            aria-invalid={trackingError ? true : undefined}
                            aria-describedby={trackingError ? 'ship-tracking-error' : undefined}
                          />
                        </div>
                        {trackingError ? (
                          <p id="ship-tracking-error" role="alert" className="bb-error-inline">
                            <AlertCircle size={13} aria-hidden="true" />
                            {trackingError}
                          </p>
                        ) : (
                          <p className="bb-muted text-xs">{t('orders.detail.trackingHint')}</p>
                        )}
                        <Input
                          type="text"
                          placeholder={t('orders.detail.carrierPlaceholder')}
                          value={shippingCarrier}
                          onChange={(e) => setShippingCarrier(e.target.value)}
                          disabled={saving}
                        />
                        <div className="bb-detail-form-actions">
                          <Button type="submit" size="sm" disabled={saving}>
                            {saving ? t('orders.detail.savingShort') : t('orders.detail.confirmShipping')}
                          </Button>
                          <Button type="button" variant="secondary" size="sm" disabled={saving}
                            onClick={() => { setShowShipForm(false); setTrackingNumber(''); setShippingCarrier(''); setTrackingError('') }}>
                            {t('common.cancel')}
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })()}

      <div className="bb-grid-2-1">
        {/* Left column */}
        <div className="bb-stack">
          {/* Items */}
          <div className="bb-card">
            <div className="bb-card-header">
              <h3>{t('orders.detail.items')} ({(order.items ?? []).length})</h3>
            </div>
            <div className="bb-card-body--flush">
              {(order.items ?? []).length === 0 ? (
                <div className="bb-card-body"><p className="bb-muted">{t('orders.detail.noItems')}</p></div>
              ) : (
                <>
                <div className="hide-on-mobile">
                <div className="bb-table-wrap">
                  <table className="bb-table">
                    <thead>
                      <tr>
                        <th>{t('orders.detail.colProduct')}</th>
                        <th className="num">{t('orders.detail.colUnitPrice')}</th>
                        <th className="num">{t('orders.detail.colQty')}</th>
                        <th className="num">{t('orders.detail.colLineTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items ?? []).map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="bb-product-cell">
                              <OrderItemThumbnail item={item} />
                              <div>
                                <div className="font-semibold">{formatText(item.productName)}</div>
                                {item.variantName && <div className="bb-cell-sub">{item.variantName}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="num">{formatCurrencyVnd(item.unitPrice)}</td>
                          <td className="num">×{item.quantity}</td>
                          <td className="num font-bold">{formatCurrencyVnd(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
                <MobileCardList>
                  {(order.items ?? []).map((item) => (
                    <MobileCard
                      key={item.id}
                      title={(
                        <span className="flex items-center gap-2">
                          <OrderItemThumbnail item={item} />
                          <span>{formatText(item.productName)}</span>
                        </span>
                      )}
                      subtitle={item.variantName || undefined}
                      meta={[
                        { label: t('orders.detail.colUnitPrice'), value: formatCurrencyVnd(item.unitPrice) },
                        { label: t('orders.detail.colQty'), value: `×${item.quantity}` },
                        { label: t('orders.detail.colLineTotal'), value: formatCurrencyVnd(item.lineTotal), tone: 'strong' },
                      ]}
                    />
                  ))}
                </MobileCardList>
                </>
              )}
              <div className="bb-total-panel">
                <dl className="bb-info-grid bb-total-grid">
                  <dt>{t('orders.detail.subtotal')}</dt>
                  <dd>{formatCurrencyVnd(order.subtotal)}</dd>
                  {order.shippingFee > 0 && (
                    <>
                      <dt>{t('orders.detail.shippingFee')}</dt>
                      <dd>{formatCurrencyVnd(order.shippingFee)}</dd>
                    </>
                  )}
                  {order.discount > 0 && (
                    <>
                      <dt>{t('orders.detail.discount')}</dt>
                      <dd className="text-danger">-{formatCurrencyVnd(order.discount)}</dd>
                    </>
                  )}
                  <dt className="bb-total-label">{t('orders.detail.total')}</dt>
                  <dd className="bb-total-value">
                    {formatCurrencyVnd(order.total)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Payments — thu gọn mặc định, admin bấm mở khi cần đối chiếu tiền
              (có thể nhiều dòng với đơn thanh toán từng phần / hoàn tiền nhiều đợt). */}
          {(order.payments ?? []).length > 0 && (
            <div className="bb-card">
              <details className="bb-foldable">
                <summary>
                  {t('orders.detail.payments')} ({(order.payments ?? []).length})
                  <ChevronRight size={16} className="bb-foldable-chev" aria-hidden="true" />
                </summary>
                <div className="bb-foldable-body">
                <div className="hide-on-mobile">
                <div className="bb-table-wrap">
                  <table className="bb-table">
                    <thead>
                      <tr>
                        <th>{t('orders.detail.colPaymentMethod')}</th>
                        <th>{t('orders.detail.colPaymentRecordStatus')}</th>
                        <th className="num">{t('orders.detail.colAmount')}</th>
                        <th className="num">{t('orders.detail.colPaidAt')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.payments ?? []).map((p, i) => (
                        <tr key={p.id ?? i}>
                          <td className="mono">{t(`status.paymentMethod.${p.paymentMethod}`, { defaultValue: formatText(p.paymentMethod) })}</td>
                          <td>{t(`status.paymentRecord.${p.status}`, { defaultValue: p.status })}</td>
                          <td className="num">{formatCurrencyVnd(p.amount)}</td>
                          <td className="num bb-muted">{p.paidAt ? formatDateTime(p.paidAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
                <MobileCardList>
                  {(order.payments ?? []).map((p, i) => (
                    <MobileCard
                      key={p.id ?? i}
                      title={t(`status.paymentMethod.${p.paymentMethod}`, { defaultValue: formatText(p.paymentMethod) })}
                      subtitle={p.paidAt ? formatDateTime(p.paidAt) : undefined}
                      meta={[
                        { label: t('orders.detail.colAmount'), value: formatCurrencyVnd(p.amount), tone: 'strong' },
                        { label: t('orders.detail.colPaymentRecordStatus'), value: t(`status.paymentRecord.${p.status}`, { defaultValue: p.status }) },
                      ]}
                    />
                  ))}
                </MobileCardList>
                </div>
              </details>
            </div>
          )}

          {/* Notes */}
          <div className="bb-card">
            <div className="bb-card-header"><h3>{t('orders.detail.notes')}</h3></div>
            <div className="bb-card-body">
              {(order.notes ?? []).length === 0 ? (
                <p className="bb-muted">{t('orders.detail.noNotes')}</p>
              ) : (
                <ul className="bb-list-clean bb-list-spaced">
                  {(order.notes ?? []).map((note, i) => (
                    <li key={note.id ?? i} className="bb-list-item">
                      <span className="bb-muted mr-2">
                        {note.createdAt ? formatDateTime(note.createdAt) : ''}
                      </span>
                      {note.content}
                    </li>
                  ))}
                </ul>
              )}
              {canUpdate && (
                <form onSubmit={handleAddNote} className="flex flex-col gap-2">
                  <Textarea
                    rows={3}
                    placeholder={t('orders.detail.notePlaceholder')}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    disabled={submittingNote}
                    className="resize-y"
                  />
                  <div className="flex items-center gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={noteCustomerVisible}
                        onCheckedChange={(checked) => setNoteCustomerVisible(checked)}
                        disabled={submittingNote}
                      />
                      {t('orders.detail.noteCustomerVisible')}
                    </label>
                    <Button type="submit" size="sm" disabled={submittingNote || !noteContent.trim()}>
                      {submittingNote ? t('orders.detail.savingShort') : t('orders.detail.submitNote')}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Lịch sử thao tác — gộp vào cuối card Ghi chú (thay vì card riêng), thu gọn
                mặc định vì chỉ cần tra cứu khi có tranh chấp/kiểm tra, không phải xem hàng ngày. */}
            <details className="bb-foldable">
              <summary>
                {t('orders.audit.title')}
                <ChevronRight size={16} className="bb-foldable-chev" aria-hidden="true" />
              </summary>
              <div className="bb-foldable-body">
                {auditQuery.isLoading ? (
                  <p className="bb-muted">{t('orders.audit.loading')}</p>
                ) : auditQuery.isError ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="bb-muted m-0">{t('orders.audit.error')}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => auditQuery.refetch()}>
                      {t('common.retry')}
                    </Button>
                  </div>
                ) : (auditQuery.data ?? []).length === 0 ? (
                  <p className="bb-muted">{t('orders.audit.empty')}</p>
                ) : (
                  <ul className="bb-list-clean">
                    {(auditQuery.data ?? []).map((entry, i) => (
                      <li key={entry.id ?? i} className="bb-list-item">
                        <div className="flex items-center justify-between gap-2">
                          <span className="bb-list-title">
                            {t(`orders.audit.action.${entry.action}`, { defaultValue: entry.action })}
                          </span>
                          <span className="bb-muted">{entry.createdAt ? formatDateTime(entry.createdAt) : ''}</span>
                        </div>
                        <div className="bb-list-meta">
                          {t(`orders.audit.actor.${entry.actorType}`, { defaultValue: entry.actorType })}{entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          </div>
        </div>

        {/* Right column */}
        <div className="bb-stack">
          {/* Customer */}
          <div className="bb-card">
            <div className="bb-card-header"><h3>{t('orders.detail.customerInfo')}</h3></div>
            <div className="bb-card-body">
              <dl className="bb-info-grid">
                <dt>{t('orders.detail.name')}</dt><dd>{formatText(order.customerName)}</dd>
                <dt>{t('orders.detail.email')}</dt><dd>{formatText(order.customerEmail)}</dd>
                {order.shippingAddress && (
                  <>
                    <dt>{t('orders.detail.phone')}</dt>
                    <dd>{formatText(order.shippingAddress.phone)}</dd>
                    <dt>{t('orders.detail.address')}</dt>
                    <dd>{addressLine(order.shippingAddress) || '—'}</dd>
                  </>
                )}
                {order.billingAddress && !sameAddress(order.billingAddress, order.shippingAddress) && (
                  <>
                    <dt>{t('orders.detail.billingAddress')}</dt>
                    <dd>
                      {[order.billingAddress.fullName, order.billingAddress.phone].filter(Boolean).join(' · ')}
                      {(order.billingAddress.fullName || order.billingAddress.phone) && <br />}
                      {addressLine(order.billingAddress) || '—'}
                    </dd>
                  </>
                )}
                {order.customerNote && (
                  <>
                    <dt>{t('orders.detail.customerNote')}</dt>
                    <dd className="bb-prewrap-strong">{order.customerNote}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Shipping metadata */}
          {order.fulfillmentType === 'DELIVERY' && (
            <div className="bb-card">
              <div className="bb-card-header"><h3>{t('orders.detail.shipping')}</h3></div>
              <div className="bb-card-body">
                {hasShippingDetails && (
                  <dl className="bb-info-grid">
                  {shippingReference && (
                    <>
                      <dt>{t('orders.detail.colRma', { defaultValue: 'Mã vận đơn' })}</dt>
                      <dd className="mono">
                        {shippingReference}
                      </dd>
                    </>
                  )}
                  {order.shippedAt && (
                    <>
                      <dt>{t('orders.detail.shippedAtLabel')}</dt>
                      <dd>{formatDateTime(order.shippedAt)}</dd>
                    </>
                  )}
                  </dl>
                )}
                {!hasShippingDetails && <p className="bb-muted m-0">{t('orders.detail.shippingPendingInfo')}</p>}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="bb-card">
            <div className="bb-card-header"><h3>{t('orders.detail.timestamps')}</h3></div>
            <div className="bb-card-body">
              <dl className="bb-info-grid">
                {order.placedAt && (<><dt>{t('orders.detail.tsPlacedAt')}</dt><dd>{formatDateTime(order.placedAt)}</dd></>)}
                {order.paidAt && (<><dt>{t('orders.detail.tsPaidAt')}</dt><dd>{formatDateTime(order.paidAt)}</dd></>)}
                {order.completedAt && (<><dt>{t('orders.detail.tsCompletedAt')}</dt><dd>{formatDateTime(order.completedAt)}</dd></>)}
                {order.cancelledAt && (<><dt>{t('orders.detail.tsCancelledAt')}</dt><dd>{formatDateTime(order.cancelledAt)}</dd></>)}
                {order.updatedAt && (<><dt>{t('orders.detail.tsUpdatedAt')}</dt><dd>{formatDateTime(order.updatedAt)}</dd></>)}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {reasonModal && (
        <ReasonConfirmModal
          loading={saving}
          onConfirm={async (reason) => {
            const ok = await doStatusChange(reasonModal.targetStatus, reason)
            if (ok) setReasonModal(null)
          }}
          onClose={() => setReasonModal(null)}
        />
      )}
    </div>
  )
}
