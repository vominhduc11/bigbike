import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { ArrowRight, ChevronRight, Package } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { MobileCardList, MobileCard } from '../components/layout/MobileCardList'
import { StickyActionBar } from '../components/layout'
import { fetchOrderAllowedTransitions, fetchOrderAuditTrail, fetchOrderDetail, updateOrderStatus } from '../lib/adminApi'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { ORDER_STATUS_TONE } from '../lib/statusTone'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'
import { readDraft, useDraftAutosave } from '../lib/useDraftAutosave'
import { recordRecentItem } from '../lib/useRecentItems'
import { useAdminPresence } from '../lib/useAdminPresence'
import { Button } from '@/components/ui/button'
import {
  REASON_REQUIRED, addressLine, sameAddress,
  ORDER_STATUS_ACTION, getOrderStatusLabel, getOrderMutationError, getOrderAuditDetails,
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
function SkeletonBlock({ className = '' }) {
  return <div className={`bb-skeleton-block ${className}`} />
}

function OrderDetailSkeleton({ label }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="bb-screen-header">
        <div className="bb-screen-title bb-stack-xs">
          <SkeletonBlock className="h-7 w-64 max-w-full" />
          <SkeletonBlock className="h-4 w-48 max-w-full" />
        </div>
      </div>
      <div className="mb-4"><SkeletonBlock className="h-20" /></div>
      <div className="bb-grid-2-1">
        <div className="bb-stack">
          <SkeletonBlock className="h-56" />
          <SkeletonBlock className="h-36" />
          <SkeletonBlock className="h-36" />
        </div>
        <div className="bb-stack">
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-36" />
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

  // Live-refresh khi đơn đang xem có thay đổi trạng thái đẩy về
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

  // Khi hệ thống mở lại, tải lại dữ liệu thật của đơn. Không khôi phục trạng thái
  // lạc quan và không tự tải lại toàn bộ trang admin.
  useEffect(() => {
    const unsubscribe = subscribeAdminWs('/topic/admin/maintenance', (event) => {
      if (event?.state === 'NORMAL') {
        queryClient.invalidateQueries({ queryKey: ['order', orderId] })
        queryClient.invalidateQueries({ queryKey: ['order-transitions', orderId] })
        queryClient.invalidateQueries({ queryKey: ['order-audit', orderId] })
      }
    })
    return unsubscribe
  }, [orderId, queryClient])

  const order = orderQuery.data?.item ?? null
  const transitionsQuery = useQuery({
    queryKey: ['order-transitions', orderId, order?.orderStatus],
    queryFn: () => fetchOrderAllowedTransitions(orderId),
    enabled: Boolean(canUpdate && orderQuery.isSuccess && order?.orderStatus),
  })
  const status = orderQuery.isLoading
    ? 'loading'
    : orderQuery.isError && !orderQuery.data
      ? 'error'
      : 'success'

  const [saving, setSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [reasonModal, setReasonModal] = useState(null)
  const [reasonDraft, setReasonDraft] = useState('')
  const [unsavedActionWarning, setUnsavedActionWarning] = useState('')

  const orderReasonDraftKey = `draft:order-detail:${orderId}:status-reason`
  const { clear: clearOrderReasonDraft } = useDraftAutosave(
    orderReasonDraftKey,
    { orderId, targetStatus: reasonModal?.targetStatus ?? null, reason: reasonDraft },
    { enabled: Boolean(reasonModal), dirty: Boolean(reasonModal && reasonDraft.trim()) },
  )

  useUnsavedChanges(false)

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

  async function doStatusChange(newStatus, reason) {
    setSaving(true)
    setPendingAction(`status:${newStatus}`)
    try {
      const response = await updateOrderStatus(orderId, newStatus, reason)
      const updatedOrder = response.item
      applyOrderUpdate(updatedOrder)
      clearOrderReasonDraft()
      setUnsavedActionWarning('')
      toast.success(t('orders.detail.statusUpdated'))
      return true
    } catch (err) {
      toast.error(getOrderMutationError(err, t))
      const errorStatus = Number(err?.status)
      // 423 MAINTENANCE_ACTIVE: khoá bảo trì trang quản trị đã từ chối thao tác ghi.
      // Cố ý KHÔNG dùng 503 — nginx nuốt thân phản hồi 503 nên mã lỗi không tới được đây.
      const maintenanceFailure = err?.code === 'MAINTENANCE_ACTIVE'
        || errorStatus === 423
        || errorStatus === 0
        || err?.code === 'NETWORK_ERROR'
      if (maintenanceFailure) {
        setUnsavedActionWarning(t('orders.detail.unsavedActionWarning', {
          defaultValue: 'Thao tác CHƯA được lưu. Hệ thống đang bảo trì hoặc kết nối đã ngắt. Sau khi hệ thống hoạt động, dữ liệu đơn sẽ được tải lại.',
        }))
        setReasonModal(null)
        clearOrderReasonDraft()
        await Promise.allSettled([
          orderQuery.refetch(),
          transitionsQuery.refetch(),
          auditQuery.refetch(),
        ])
      }
      if (errorStatus === 404) {
        setReasonModal(null)
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        navigate('/admin/orders')
      } else if (errorStatus === 409) {
        setReasonModal(null)
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        await Promise.allSettled([
          orderQuery.refetch(),
          transitionsQuery.refetch(),
          auditQuery.refetch(),
        ])
      }
      return false
    } finally {
      setSaving(false)
      setPendingAction(null)
    }
  }

  async function handleStatusChange(newStatus) {
    if (REASON_REQUIRED.has(newStatus)) {
      const saved = readDraft(orderReasonDraftKey)
      const savedReason = saved?.value?.orderId != null
        && String(saved.value.orderId) === String(orderId)
        && saved.value.targetStatus === newStatus
        ? saved.value.reason
        : ''
      setReasonDraft(savedReason || '')
      setReasonModal({ targetStatus: newStatus })
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

  function closeReasonModal() {
    clearOrderReasonDraft()
    setReasonDraft('')
    setReasonModal(null)
  }

  if (status === 'loading') {
    return <OrderDetailSkeleton label={t('orders.detail.loading')} />
  }
  if (status === 'error') {
    if (Number(orderQuery.error?.status) === 404) {
      return <StatePanel tone="neutral" title={t('orders.detail.notFound')} description={`ID: ${orderId}`}
        actionLabel={t('common.back')} onAction={() => navigate('/admin/orders')} />
    }
    if (Number(orderQuery.error?.status) === 403) {
      return <StatePanel tone="danger" title={t('orders.detail.loadForbidden')}
        description={t('orders.detail.loadForbiddenDesc')}
        actionLabel={t('common.back')} onAction={() => navigate('/admin/orders')} />
    }
    return <StatePanel tone="danger" title={t('orders.detail.loadError')}
      description={t('orders.detail.loadErrorDesc')}
      actionLabel={t('common.retry')} onAction={() => orderQuery.refetch()} />
  }
  if (!order) {
    return <StatePanel tone="neutral" title={t('orders.detail.notFound')} description={`ID: ${orderId}`}
      actionLabel={t('common.back')} onAction={() => navigate('/admin/orders')} />
  }

  const allowedTransitions = transitionsQuery.data?.transitions ?? []
  const transitionsLoading = transitionsQuery.isFetching && !transitionsQuery.data
  const transitionsError = transitionsQuery.isError
  // Khoá các nút chuyển trạng thái khi đang lưu hoặc dữ liệu nền đang cập nhật,
  // tránh thao tác dựa trên trạng thái cũ.
  const actionsBusy = saving || orderQuery.isFetching || orderQuery.isError || transitionsLoading

  const orderProgressTransitions = allowedTransitions.filter((status) => status !== 'CANCELLED')
  const hasOrderGroup = orderProgressTransitions.length > 0 || transitionsLoading || transitionsError
  const canCancelOrder = !transitionsError && allowedTransitions.includes('CANCELLED')
  const hasAnyAction = hasOrderGroup || canCancelOrder
  const useMobileStickyActions = hasAnyAction && !transitionsLoading && !transitionsError
  const paymentMethodLabel = order.paymentMethod
    ? t(`status.paymentMethod.${order.paymentMethod}`, { defaultValue: t('common.unknown') })
    : formatText()

  function renderProgressAction(targetStatus, keyPrefix = '') {
    const cfg = ORDER_STATUS_ACTION[targetStatus] ?? { variant: 'secondary' }
    const isPrimary = cfg.variant === 'primary' || cfg.variant === 'success'
    const isPending = pendingAction === `status:${targetStatus}`
    return (
      <Button
        key={`${keyPrefix}${targetStatus}`}
        type="button"
        variant={isPrimary ? 'default' : 'secondary'}
        className="min-h-11"
        disabled={actionsBusy}
        aria-busy={isPending}
        onClick={() => handleStatusChange(targetStatus)}
      >
        {isPending
          ? t('orders.detail.savingShort')
          : <><ArrowRight size={14} aria-hidden="true" />{getOrderStatusLabel(targetStatus, order, t)}</>}
      </Button>
    )
  }

  function renderCancelAction(keyPrefix = '') {
    const isPending = pendingAction === 'status:CANCELLED'
    return (
      <Button
        key={`${keyPrefix}CANCELLED`}
        type="button"
        variant="ghost"
        className="min-h-11 text-danger"
        disabled={actionsBusy}
        aria-busy={isPending}
        onClick={() => handleStatusChange('CANCELLED')}
      >
        {isPending ? t('orders.detail.savingShort') : getOrderStatusLabel('CANCELLED', order, t)}
      </Button>
    )
  }

  return (
    <div className={useMobileStickyActions ? 'pb-32 md:pb-0' : undefined}>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <h1 className="bb-heading-inline">
            {t('orders.detail.eyebrow')}{' '}
            <span className="mono bb-heading-key">
              {formatText(order.orderNumber, `#${orderId}`)}
            </span>
          </h1>
          <dl className="bb-muted flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-1">
              <dt>{t('orders.detail.orderDate')}</dt>
              <dd>{formatDateTime(order.createdAt)}</dd>
            </div>
            <div className="flex items-center gap-1">
              <dt>{t('orders.detail.paymentMethod')}</dt>
              <dd className="mono">{paymentMethodLabel}</dd>
            </div>
          </dl>
        </div>
        <div className="bb-screen-actions">
          <Button type="button" variant="secondary" className="min-h-11" onClick={() => navigate(`/admin/orders${readListQuery()}`)}>
            {t('orders.detail.backToList')}
          </Button>
        </div>
      </div>

      {!canUpdate ? <ReadOnlyBanner warning={t('orders.readOnlyWarning')} /> : null}

      {unsavedActionWarning ? (
        <Alert tone="warning" size="sm" className="mb-4" role="alert">
          {unsavedActionWarning}
        </Alert>
      ) : null}

      {orderQuery.isError && orderQuery.data ? (
        <Alert tone="danger" size="sm" className="mb-4 flex flex-wrap items-center justify-between gap-3" role="alert">
          <span>{t('orders.detail.refreshError')}</span>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => orderQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </Alert>
      ) : orderQuery.isFetching && !orderQuery.isLoading ? (
        <Alert tone="info" size="sm" className="mb-4" role="status">
          {t('orders.refreshing')}
        </Alert>
      ) : null}

      {hasOtherAdmin ? (
        <Alert tone="warning" size="sm" className="mb-4">
          {t('orders.detail.otherAdminPresent')}
        </Alert>
      ) : null}

      {/* Tầng 1 — dải trạng thái (trái) + việc cần làm tiếp (phải): toàn cảnh đơn
          hàng trong 1 lần nhìn, thay vì 3 khối trạng thái rời + panel hành động
          full-width như trước. */}
      {(() => {
        const tiles = (
          <div className="bb-status-tiles bb-status-tiles--1">
            <div className={`bb-status-tile bb-status-tile--${ORDER_STATUS_TONE[order.orderStatus] ?? 'muted'}`}>
              <div className="bb-status-tile-k">{t('orders.detail.tileOrder')}</div>
              <StatusBadge type="order" status={order.orderStatus} />
              <div className="bb-cell-sub">{t('orders.detail.tileOrderDate', { date: formatDateTime(order.placedAt) })}</div>
            </div>
          </div>
        )

        if (!canUpdate) return tiles

        return (
          <div className="bb-status-summary">
            {tiles}
            <div className={`bb-actionzone ${useMobileStickyActions ? 'hide-on-mobile' : ''}`}>
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
                        {transitionsLoading ? (
                          <span role="status" className="bb-muted">{t('orders.detail.loadingActions')}</span>
                        ) : null}
                        {transitionsError ? (
                          <>
                            <span role="alert" className="text-danger">{t('orders.detail.transitionsLoadError')}</span>
                            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => transitionsQuery.refetch()}>
                              {t('common.retry')}
                            </Button>
                          </>
                        ) : null}
                        {!transitionsLoading && !transitionsError
                          ? orderProgressTransitions.map((targetStatus) => renderProgressAction(targetStatus))
                          : null}
                      </div>
                    </div>
                  )}

                  {canCancelOrder && (
                    <div className="bb-actionzone-group">
                      <div className="bb-actionzone-group-label">{t('orders.detail.otherActions')}</div>
                      <div className="bb-actionzone-actions">
                        {renderCancelAction()}
                      </div>
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
                    <caption className="sr-only">{t('orders.detail.items')}</caption>
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
                  {order.feeAmount > 0 && (
                    <>
                      <dt>{t('orders.detail.feeAmount')}</dt>
                      <dd>{formatCurrencyVnd(order.feeAmount)}</dd>
                    </>
                  )}
                  {order.taxAmount > 0 && (
                    <>
                      <dt>{t('orders.detail.taxAmount')}</dt>
                      <dd>{formatCurrencyVnd(order.taxAmount)}</dd>
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
                    <caption className="sr-only">{t('orders.detail.payments')}</caption>
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
                          <td className="mono">
                            {p.paymentMethod
                              ? t(`status.paymentMethod.${p.paymentMethod}`, { defaultValue: t('common.unknown') })
                              : formatText()}
                          </td>
                          <td>{p.status ? t(`status.paymentRecord.${p.status}`, { defaultValue: t('common.unknown') }) : t('common.unknown')}</td>
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
                      title={p.paymentMethod
                        ? t(`status.paymentMethod.${p.paymentMethod}`, { defaultValue: t('common.unknown') })
                        : formatText()}
                      subtitle={p.paidAt ? formatDateTime(p.paidAt) : undefined}
                      meta={[
                        { label: t('orders.detail.colAmount'), value: formatCurrencyVnd(p.amount), tone: 'strong' },
                        {
                          label: t('orders.detail.colPaymentRecordStatus'),
                          value: p.status
                            ? t(`status.paymentRecord.${p.status}`, { defaultValue: t('common.unknown') })
                            : t('common.unknown'),
                        },
                      ]}
                    />
                  ))}
                </MobileCardList>
                </div>
              </details>
            </div>
          )}

          {/* Audit trail */}
          <div className="bb-card">
            <div className="bb-card-body">
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
                      <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => auditQuery.refetch()}>
                        {t('common.retry')}
                      </Button>
                    </div>
                  ) : (auditQuery.data ?? []).length === 0 ? (
                    <p className="bb-muted">{t('orders.audit.empty')}</p>
                  ) : (
                    <ul className="bb-list-clean">
                      {(auditQuery.data ?? []).map((entry, i) => {
                        const details = getOrderAuditDetails(entry, t)
                        return (
                          <li key={entry.id ?? i} className="bb-list-item">
                            <div className="flex items-center justify-between gap-2">
                              <span className="bb-list-title">
                                {entry.action
                                  ? t(`orders.audit.action.${entry.action}`, { defaultValue: t('common.unknown') })
                                  : t('common.unknown')}
                              </span>
                              <span className="bb-muted">{entry.createdAt ? formatDateTime(entry.createdAt) : ''}</span>
                            </div>
                            <div className="bb-list-meta">
                              {entry.actorType
                                ? t(`orders.audit.actor.${entry.actorType}`, { defaultValue: t('common.unknown') })
                                : t('common.unknown')}
                              {entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
                            </div>
                            {details.transition ? <div className="bb-list-meta">{details.transition}</div> : null}
                            {details.cancelReason ? (
                              <div className="bb-list-meta">
                                {t('orders.audit.cancelReason', { reason: details.cancelReason })}
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </details>
            </div>
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
                <dt>{t('orders.detail.phone')}</dt>
                <dd>{formatText(order.shippingAddress?.phone || order.customerPhone)}</dd>
                {order.shippingAddress && (
                  <>
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

          {/* Timestamps */}
          <div className="bb-card">
            <div className="bb-card-header"><h3>{t('orders.detail.timestamps')}</h3></div>
            <div className="bb-card-body">
              <dl className="bb-info-grid">
                {order.placedAt && (<><dt>{t('orders.detail.tsPlacedAt')}</dt><dd>{formatDateTime(order.placedAt)}</dd></>)}
                {order.paidAt && (<><dt>{t('orders.detail.tsPaidAt')}</dt><dd>{formatDateTime(order.paidAt)}</dd></>)}
                {order.completedAt && (<><dt>{t('orders.detail.tsCompletedAt')}</dt><dd>{formatDateTime(order.completedAt)}</dd></>)}
                {order.cancelledAt && (<><dt>{t('orders.detail.tsCancelledAt')}</dt><dd>{formatDateTime(order.cancelledAt)}</dd></>)}
                {order.cancelReason && (<><dt>{t('orders.detail.cancelReasonLabel')}</dt><dd>{order.cancelReason}</dd></>)}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {canUpdate && useMobileStickyActions ? (
        <div className="show-on-mobile fixed inset-x-0 bottom-4 z-40 bg-background pb-[env(safe-area-inset-bottom)] [&_.sticky-action-bar]:m-0">
          <StickyActionBar ariaLabel={t('orders.detail.mobileActionsLabel')}>
            {orderProgressTransitions.map((targetStatus) => renderProgressAction(targetStatus, 'mobile-'))}
            {canCancelOrder ? renderCancelAction('mobile-') : null}
          </StickyActionBar>
        </div>
      ) : null}

      {reasonModal && (
        <ReasonConfirmModal
          loading={saving}
          initialReason={reasonDraft}
          onReasonChange={setReasonDraft}
          onConfirm={async (reason) => {
            const ok = await doStatusChange(reasonModal.targetStatus, reason)
            if (ok) {
              setReasonDraft('')
              setReasonModal(null)
            }
          }}
          onClose={closeReasonModal}
        />
      )}
    </div>
  )
}
