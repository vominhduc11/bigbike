import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CircleDollarSign,
  Clock,
  Minus,
  Package,
  PackageOpen,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '@/components/ui/button'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { MobileCardList, MobileCard } from '../components/layout/MobileCardList'
import { formatVndShort, formatRelativeTime } from '../lib/formatters'
import { useAuth } from '../lib/auth'
import { useRecentItems } from '../lib/useRecentItems'
import {
  fetchDashboardSummary,
  fetchInventorySummary,
} from '../lib/adminApi'

const PENDING_WARN_THRESHOLD = 5

const ORDER_STATUS_COLORS = {
  PENDING:    'var(--admin-color-status-warning-text)',
  ON_HOLD:    'var(--admin-color-text-muted)',
  PROCESSING: 'var(--admin-color-status-info-text)',
  COMPLETED:  'var(--admin-color-status-success-text)',
  CANCELLED:  'var(--admin-color-status-danger-text)',
  FAILED:     'var(--admin-color-status-warning-orange-text)',
}

// Charts pull in recharts (~346KB) — load them lazily so the dashboard shell
// (KPIs + tables) paints immediately and the charts stream in afterwards.
const RevenueAreaChart = lazy(() => import('./dashboard/charts').then((m) => ({ default: m.RevenueAreaChart })))
const OrderStatusPie = lazy(() => import('./dashboard/charts').then((m) => ({ default: m.OrderStatusPie })))

function TrendPill({ direction, label }) {
  const cls = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'flat'
  const icon =
    direction === 'up' ? <TrendingUp size={10} /> :
    direction === 'down' ? <TrendingDown size={10} /> :
    <Minus size={10} />
  return (
    <span className={`bb-kpi-trend ${cls}`}>
      {icon}{label}
    </span>
  )
}

function SectionEmpty({ title, description }) {
  return (
    <div className="bb-state">
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
    </div>
  )
}

// Đưa hành vi mở-bằng-bàn-phím (Enter/Space) cho phần tử click được nhưng
// không phải <a>/<button>. Trả về props role/tabIndex/onKeyDown chuẩn.
function clickableProps(onActivate, label) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onClick: onActivate,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onActivate()
      }
    },
  }
}

function SkeletonBlock({ height = 280 }) {
  return <div className="bb-skeleton-block" style={{ height }} />
}

export function DashboardScreen({ navigate }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [period, setPeriod] = useState('30d')
  // O9 — đơn hàng admin vừa xem gần đây, cho phép quay lại nhanh.
  const recentOrderItems = useRecentItems('recent:orders')

  const now = new Date()
  const hour = now.getHours()
  const greetingKey =
    hour < 12 ? 'greetingMorning' : hour < 18 ? 'greetingAfternoon' : 'greetingEvening'
  const firstName =
    (user?.fullName || '').trim().split(/\s+/).filter(Boolean).slice(-1)[0] || ''
  const todayLabel = now.toLocaleDateString(
    i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  )

  // Số liệu vận hành (doanh thu, tồn thấp, đơn chờ) cần tươi mà không cần
  // instant → polling định kỳ 90s + làm mới khi admin quay lại tab. Refetch chạy nền,
  // không show loading lại (refetchInterval mặc định không bật loading state).
  const DASHBOARD_REFRESH_MS = 90_000

  const { data: dashResult, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => fetchDashboardSummary(period),
    staleTime: 60_000,
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

  const { data: invSummary, isError: invIsError } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: fetchInventorySummary,
    staleTime: 60_000,
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

  const state = {
    status: isLoading ? 'loading' : isError ? 'error' : 'ok',
    data: dashResult?.data ?? null,
  }
  const { data } = state

  const periodTabs = [
    { key: '7d',  label: t('dashboard.period7d')  },
    { key: '30d', label: t('dashboard.period30d') },
    { key: '90d', label: t('dashboard.period90d') },
  ]

  const pieTotal = data
    ? data.orderStatusBreakdown.reduce((s, d) => s + d.count, 0)
    : 0

  const pieDataWithTotal = data
    ? data.orderStatusBreakdown.map((d) => ({
        ...d,
        name: t(`status.order.${d.status}`, d.status),
        color: ORDER_STATUS_COLORS[d.status] ?? 'var(--admin-color-text-muted)',
        total: pieTotal,
      }))
    : []

  const revenueData = data?.revenueData ?? []
  const hasRevenue = revenueData.some((d) => d.revenue > 0)
  const recentOrders = data?.recentOrders ?? []
  const topProducts = data?.topProducts ?? []

  function revenueTrend(kpi) {
    const pct = kpi?.todayRevenuePct
    if (pct == null) return { direction: 'neutral', label: t('dashboard.kpi.trendNoData') }
    const absPct = Math.abs(pct)
    const formattedValue = absPct > 999 ? '>999' : absPct
    if (pct > 0)  return { direction: 'up',   label: t('dashboard.kpi.trendUp',   { value: formattedValue }) }
    if (pct < 0)  return { direction: 'down', label: t('dashboard.kpi.trendDown', { value: formattedValue }) }
    return { direction: 'neutral', label: t('dashboard.kpi.trendFlat') }
  }

  function ordersTrend(kpi) {
    const delta = kpi?.todayOrdersDelta
    if (delta == null) return { direction: 'neutral', label: t('dashboard.kpi.trendNoData') }
    if (delta > 0) return { direction: 'up',   label: t('dashboard.kpi.ordersDeltaUp',   { count: delta }) }
    if (delta < 0) return { direction: 'down', label: t('dashboard.kpi.ordersDeltaDown', { count: Math.abs(delta) }) }
    return { direction: 'neutral', label: t('dashboard.kpi.ordersDeltaFlat') }
  }

  const pendingOrdersCount = data?.kpi.pendingOrders ?? 0
  const outOfStockCount = invSummary?.outOfStockCount ?? 0

  const SEVERITY_RANK = { high: 0, medium: 1, low: 2 }
  const SEVERITY_TONE = { high: 'danger', medium: 'warning', low: 'info' }
  const SEVERITY_LABEL = {
    high: t('dashboard.attention.severityHigh'),
    medium: t('dashboard.attention.severityMedium'),
    low: t('dashboard.attention.severityLow'),
  }

  const attentionItems = [
    outOfStockCount > 0 && {
      key: 'outOfStock',
      severity: 'high',
      icon: <PackageOpen size={18} />,
      label: t('dashboard.attention.outOfStock.label'),
      count: outOfStockCount,
      hint: t('dashboard.attention.outOfStock.hint'),
      cta: t('dashboard.attention.viewAction'),
      onClick: () => navigate('/admin/products?stockState=OUT_OF_STOCK'),
    },
    pendingOrdersCount > 0 && {
      key: 'pendingOrders',
      severity: pendingOrdersCount > PENDING_WARN_THRESHOLD ? 'high' : 'medium',
      icon: <Clock size={18} />,
      label: t('dashboard.attention.pendingOrders.label'),
      count: pendingOrdersCount,
      hint: t('dashboard.attention.pendingOrders.hint'),
      cta: t('dashboard.attention.viewAction'),
      onClick: () => navigate('/admin/orders'),
    },
  ]
    .filter(Boolean)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('dashboard.eyebrow')}</p>
          <h1>
            {firstName
              ? t(`dashboard.${greetingKey}`, { name: firstName })
              : t(`dashboard.${greetingKey}Fallback`)}
          </h1>
          <p className="bb-muted">{t('dashboard.greetingDesc', { date: todayLabel })}</p>
        </div>
        <div className="bb-screen-actions">
          <div
            className="bb-seg"
            role="group"
            aria-label={t('dashboard.periodControlLabel')}
          >
            {periodTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={period === tab.key}
                className={period === tab.key ? 'active' : ''}
                onClick={() => setPeriod(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('common.error')}
          description={t('dashboard.loadError')}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      )}

      {state.status === 'loading' && !data && (
        <>
          <div className="bb-kpi-grid">
            {[...Array(4)].map((_, i) => (
              <SkeletonBlock key={i} height={120} />
            ))}
          </div>
          <SkeletonBlock height={84} />
          <div className="bb-grid-2-1">
            <SkeletonBlock height={300} />
            <SkeletonBlock height={300} />
          </div>
        </>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className="bb-kpi-grid">
            <div
              className="bb-kpi clickable"
              {...clickableProps(
                () => navigate('/admin/reports'),
                t('dashboard.kpi.todayRevenueAria'),
              )}
            >
              <div className="bb-kpi-head">
                <span>
                  {t('dashboard.kpi.todayRevenue')}
                  <span className="bb-badge bb-badge-muted ml-2">{t('dashboard.kpi.todayScope')}</span>
                </span>
                <span className="bb-kpi-icon brand"><CircleDollarSign size={15} /></span>
              </div>
              <div className="bb-kpi-value bb-kpi-value--money">{formatVndShort(data.kpi.todayRevenue)}</div>
              <div className="bb-kpi-foot">
                <TrendPill {...revenueTrend(data.kpi)} />
                <span className="bb-kpi-foot-label">
                  {t('dashboard.kpi.todayPaid', { amount: formatVndShort(data.kpi.todayPaidRevenue) })}
                </span>
              </div>
            </div>

            <div
              className="bb-kpi clickable"
              {...clickableProps(
                () => navigate('/admin/orders'),
                t('dashboard.kpi.todayOrdersAria'),
              )}
            >
              <div className="bb-kpi-head">
                <span>
                  {t('dashboard.kpi.todayOrders')}
                  <span className="bb-badge bb-badge-muted ml-2">{t('dashboard.kpi.todayScope')}</span>
                </span>
                <span className="bb-kpi-icon info"><ShoppingBag size={15} /></span>
              </div>
              <div className="bb-kpi-value">{data.kpi.todayOrders.toLocaleString('vi-VN')}</div>
              <div className="bb-kpi-foot">
                <TrendPill {...ordersTrend(data.kpi)} />
                <span className="bb-kpi-foot-label">{t('dashboard.kpi.todayOrdersHint')}</span>
              </div>
            </div>

            <div
              className="bb-kpi clickable"
              {...clickableProps(
                () => navigate('/admin/orders'),
                t('dashboard.kpi.pendingOrdersAria'),
              )}
            >
              <div className="bb-kpi-head">
                <span>
                  {t('dashboard.kpi.pendingOrders')}
                  <span className="bb-badge bb-badge-muted ml-2">{t('dashboard.kpi.currentScope')}</span>
                </span>
                <span className={`bb-kpi-icon ${data.kpi.pendingOrders > PENDING_WARN_THRESHOLD ? 'danger' : 'warning'}`}>
                  <Clock size={15} />
                </span>
              </div>
              <div className="bb-kpi-value">{data.kpi.pendingOrders.toLocaleString('vi-VN')}</div>
              <div className="bb-kpi-foot">
                <span className="bb-kpi-foot-label">{t('dashboard.kpi.pendingOrdersHint')}</span>
              </div>
            </div>

            <div
              className="bb-kpi clickable"
              {...clickableProps(
                () => navigate('/admin/products'),
                t('dashboard.kpi.activeProductsAria'),
              )}
            >
              <div className="bb-kpi-head">
                <span>
                  {t('dashboard.kpi.activeProducts')}
                  <span className="bb-badge bb-badge-muted ml-2">{t('dashboard.kpi.currentScope')}</span>
                </span>
                <span className="bb-kpi-icon success"><Package size={15} /></span>
              </div>
              <div className="bb-kpi-value">{data.kpi.activeProducts.toLocaleString('vi-VN')}</div>
              <div className="bb-kpi-foot">
                <span className="bb-kpi-foot-label">{t('dashboard.kpi.activeProductsHint')}</span>
              </div>
            </div>
          </div>

          {/* Charts row — 2:1 layout */}
          <div className="bb-grid-2-1">
            <div className="bb-card">
              <div className="bb-card-header">
                <div>
                  <h3>{t('dashboard.revenueChart.title')}</h3>
                  <p>{t('dashboard.revenueChart.subtitle')}</p>
                </div>
              </div>
              <div className="bb-card-body">
                {hasRevenue ? (
                  <Suspense fallback={<SkeletonBlock height={260} />}>
                    <RevenueAreaChart revenueData={revenueData} />
                  </Suspense>
                ) : (
                  <SectionEmpty
                    title={t('dashboard.revenueChart.empty')}
                    description={t('dashboard.revenueChart.emptyDesc')}
                  />
                )}
              </div>
            </div>

            <div className="bb-card">
              <div className="bb-card-header">
                <h3>{t('dashboard.orderStatusChart.title')}</h3>
                {pieTotal > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/admin/orders')}
                  >
                    {t('dashboard.orderStatusChart.viewAll')}<ArrowRight size={14} aria-hidden="true" />
                  </Button>
                )}
              </div>
              <div className="bb-card-body">
                {pieTotal > 0 ? (
                  <div>
                    <Suspense fallback={<SkeletonBlock height={200} />}>
                      <OrderStatusPie pieDataWithTotal={pieDataWithTotal} />
                    </Suspense>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                      {pieDataWithTotal.map((d) => (
                        <div
                          key={d.status}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: 'var(--bb-text-muted)' }}>{d.name}</span>
                          <span style={{ fontWeight: 700, color: 'var(--bb-text)' }}>
                            {d.count}
                            <span className="bb-muted" style={{ fontWeight: 400, marginLeft: 4 }}>
                              ({pieTotal > 0 ? Math.round((d.count / pieTotal) * 100) : 0}%)
                            </span>
                          </span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px dashed var(--bb-border)', fontSize: 13 }}>
                        <span className="bb-muted">{t('dashboard.orderStatusChart.total')}</span>
                        <strong>{pieTotal}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <SectionEmpty title={t('dashboard.orderStatusChart.empty')} />
                )}
              </div>
            </div>
          </div>

          {/* Attention items */}
          <div className="bb-card" style={{ marginBottom: 16 }}>
            <div className="bb-card-header">
              <div>
                <h3>{t('dashboard.attention.title')}</h3>
                <p>{t('dashboard.attention.description')}</p>
              </div>
            </div>
            <div className="bb-card-body">
              {invIsError && (
                <StatePanel
                  tone="warning"
                  description={t('dashboard.attention.inventoryWarn')}
                />
              )}
              {attentionItems.length === 0 ? (
                <SectionEmpty
                  title={t('dashboard.attention.empty')}
                  description={t('dashboard.attention.emptyDesc')}
                />
              ) : (
                <div>
                  {attentionItems.map((item) => (
                    <div
                      key={item.key}
                      className="bb-attention-item"
                      {...clickableProps(
                        item.onClick,
                        `${SEVERITY_LABEL[item.severity]}: ${item.label} (${item.count})`,
                      )}
                    >
                      <span className={`bb-attention-sev ${SEVERITY_TONE[item.severity]}`} aria-hidden="true" />
                      <span className="bb-attention-icon" aria-hidden="true">{item.icon}</span>
                      <div className="bb-attention-body">
                        <div className="bb-attention-title">{item.label}</div>
                        <div className="bb-attention-desc">{item.hint}</div>
                      </div>
                      <span className="bb-attention-count">{item.count}</span>
                      <span className="bb-btn bb-btn-ghost bb-btn-sm" aria-hidden="true">
                        {item.cta}<ArrowRight size={14} aria-hidden="true" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* O9 — Vừa xem gần đây */}
          <RecentItemsChips items={recentOrderItems} onSelect={(item) => navigate(`/admin/orders/${item.id}`)} />

          {/* Recent orders + top products */}
          <div className="bb-grid-2">
            <div className="bb-card">
              <div className="bb-card-header">
                <h3>{t('dashboard.recentOrders.title')}</h3>
                {recentOrders.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/admin/orders')}
                  >
                    {t('dashboard.recentOrders.viewAll')}<ArrowRight size={14} aria-hidden="true" />
                  </Button>
                )}
              </div>
              <div className="bb-card-body--flush">
                {recentOrders.length > 0 ? (
                  <>
                  <div className="hide-on-mobile">
                  <div className="bb-table-wrap">
                    <table className="bb-table">
                      <thead>
                        <tr>
                          <th scope="col">{t('dashboard.recentOrders.orderNumber')}</th>
                          <th scope="col">{t('dashboard.recentOrders.customer')}</th>
                          <th scope="col" className="num">{t('dashboard.recentOrders.total')}</th>
                          <th scope="col">{t('dashboard.recentOrders.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentOrders.map((order) => (
                          <tr key={order.id}>
                            <td className="mono">
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="bg-transparent border-0 p-0 font-mono text-xs cursor-pointer hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 text-left"
                                  style={{ color: 'var(--bb-primary)' }}
                                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                                >
                                  {order.orderNumber}
                                </button>
                                <span className="text-xs text-muted leading-none mt-0.5">
                                  {formatRelativeTime(order.placedAt, t)}
                                </span>
                              </div>
                            </td>
                            <td title={order.customerName || order.customerEmail || ''}>
                              {order.customerName || order.customerEmail}
                            </td>
                            <td className="num" style={{ fontWeight: 600 }}>{formatVndShort(order.total)}</td>
                            <td><StatusBadge type="order" status={order.orderStatus} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </div>
                  <MobileCardList>
                    {recentOrders.map((order) => (
                      <MobileCard
                        key={order.id}
                        title={order.orderNumber}
                        subtitle={`${order.customerName || order.customerEmail} • ${formatRelativeTime(order.placedAt, t)}`}
                        status={<StatusBadge type="order" status={order.orderStatus} />}
                        meta={[
                          { label: t('dashboard.recentOrders.total'), value: formatVndShort(order.total), tone: 'strong' },
                        ]}
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                      />
                    ))}
                  </MobileCardList>
                  </>
                ) : (
                  <div className="bb-card-body">
                    <StatePanel
                      tone="neutral"
                      title={t('dashboard.recentOrders.empty')}
                      description={t('dashboard.recentOrders.emptyDesc')}
                      actionLabel={t('dashboard.recentOrders.emptyCta')}
                      onAction={() => navigate('/admin/orders')}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bb-card">
              <div className="bb-card-header">
                <h3>{t('dashboard.topProducts.title')}</h3>
                {topProducts.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/admin/products')}
                  >
                    {t('dashboard.topProducts.viewAll')}<ArrowRight size={14} aria-hidden="true" />
                  </Button>
                )}
              </div>
              <div className="bb-card-body--flush">
                {topProducts.length > 0 ? (
                  <>
                  <div className="hide-on-mobile">
                  <div className="bb-table-wrap">
                    <table className="bb-table">
                      <thead>
                        <tr>
                          <th scope="col" style={{ width: 36 }}>{t('dashboard.topProducts.rank')}</th>
                          <th scope="col">{t('dashboard.topProducts.product')}</th>
                          <th scope="col" className="num">{t('dashboard.topProducts.units')}</th>
                          <th scope="col" className="num">{t('dashboard.topProducts.revenue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((product, idx) => (
                          <tr key={product.productId}>
                            <td>
                              <span className={`bb-rank${idx < 3 ? ` bb-rank-${idx + 1}` : ''}`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="bb-product-cell bg-transparent border-0 p-0 text-left cursor-pointer hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                                onClick={() => navigate(`/admin/products/${product.productId}`)}
                              >
                                <span className="bb-product-thumb"><Package size={18} /></span>
                                <span title={product.name}>{product.name}</span>
                              </button>
                            </td>
                            <td className="num">{product.units}</td>
                            <td className="num" style={{ fontWeight: 700, color: 'var(--bb-primary)' }}>
                              {formatVndShort(product.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </div>
                  <MobileCardList>
                    {topProducts.map((product, idx) => (
                      <MobileCard
                        key={product.productId}
                        title={`${idx + 1}. ${product.name}`}
                        meta={[
                          { label: t('dashboard.topProducts.units'), value: product.units },
                          { label: t('dashboard.topProducts.revenue'), value: formatVndShort(product.revenue), tone: 'strong' },
                        ]}
                        onClick={() => navigate(`/admin/products/${product.productId}`)}
                      />
                    ))}
                  </MobileCardList>
                  </>
                ) : (
                  <div className="bb-card-body">
                    <StatePanel
                      tone="neutral"
                      title={t('dashboard.topProducts.empty')}
                      description={t('dashboard.topProducts.emptyDesc')}
                      actionLabel={t('dashboard.topProducts.emptyCta')}
                      onAction={() => navigate('/admin/products/new')}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
