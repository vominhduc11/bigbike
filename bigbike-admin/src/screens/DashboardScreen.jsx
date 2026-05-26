import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CircleDollarSign,
  Clock,
  Minus,
  Package,
  PackageOpen,
  RotateCcw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { formatVndShort } from '../lib/formatters'
import { useAuth } from '../lib/auth'
import {
  fetchDashboardSummary,
  fetchReceivableSummary,
  fetchInventorySummary,
  fetchReturns,
} from '../lib/adminApi'

const PENDING_WARN_THRESHOLD = 5

const ORDER_STATUS_COLORS = {
  PENDING:    'var(--admin-color-status-warning-text)',
  ON_HOLD:    'var(--admin-color-text-muted)',
  PROCESSING: 'var(--admin-color-status-info-text)',
  COMPLETED:  'var(--admin-color-status-success-text)',
  CANCELLED:  'var(--admin-color-status-danger-text)',
  FAILED:     'var(--admin-color-status-danger-text)',
  REFUNDED:   'var(--admin-color-text-muted)',
}

function fmtAxisMillions(value) {
  if (!value && value !== 0) return ''
  return (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)
}

function fmtIsoDateShort(isoDate) {
  if (!isoDate) return ''
  const [, m, d] = isoDate.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

function RevenueTooltip({ active, payload, label, ordersUnit }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bb-dash-tooltip">
      <div className="bb-dash-tooltip-date">{fmtIsoDateShort(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="bb-dash-tooltip-row">
          {p.name}: {p.dataKey === 'revenue' ? formatVndShort(p.value) : `${p.value} ${ordersUnit}`}
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload, orderUnit }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const total = d.payload?.total || 1
  const pct = Math.round((d.value / total) * 100)
  return (
    <div className="bb-dash-tooltip">
      <div className="bb-dash-tooltip-name">{d.name}</div>
      <div className="bb-dash-tooltip-meta">
        {d.value} {orderUnit} ({pct}%)
      </div>
    </div>
  )
}

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

function SkeletonBlock({ height = 280 }) {
  return <div className="bb-skeleton-block" style={{ height }} />
}

export function DashboardScreen({ navigate }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [period, setPeriod] = useState('30d')

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

  const { data: dashResult, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => fetchDashboardSummary(period),
    staleTime: 60_000,
  })

  const { data: arSummary } = useQuery({
    queryKey: ['receivable-summary'],
    queryFn: fetchReceivableSummary,
    staleTime: 60_000,
  })
  const { data: invSummary } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: fetchInventorySummary,
    staleTime: 60_000,
  })
  const { data: pendingReturns } = useQuery({
    queryKey: ['returns-pending-count'],
    queryFn: () => fetchReturns({ status: 'PENDING', page: 1, pageSize: 1 }),
    staleTime: 60_000,
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
    if (pct > 0)  return { direction: 'up',   label: t('dashboard.kpi.trendUp',   { value: Math.abs(pct) }) }
    if (pct < 0)  return { direction: 'down', label: t('dashboard.kpi.trendDown', { value: Math.abs(pct) }) }
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
  const overdueCount = arSummary?.countOverdue ?? 0
  const overdueAmount = arSummary?.overdueOutstanding ?? 0
  const lowStockCount = (invSummary?.lowStockCount ?? 0) + (invSummary?.outOfStockCount ?? 0)
  const outOfStockCount = invSummary?.outOfStockCount ?? 0
  const pendingReturnsCount = pendingReturns?.pagination?.totalItems ?? 0

  const SEVERITY_RANK = { high: 0, medium: 1, low: 2 }
  const SEVERITY_TONE = { high: 'danger', medium: 'warning', low: 'info' }

  const attentionItems = [
    overdueCount > 0 && {
      key: 'overdueReceivables',
      severity: 'high',
      icon: <AlertTriangle size={18} />,
      label: t('dashboard.attention.overdueReceivables.label'),
      count: overdueCount,
      hint: t('dashboard.attention.overdueReceivables.hint', { amount: formatVndShort(overdueAmount) }),
      cta: t('dashboard.attention.viewAction'),
      onClick: () => navigate('/admin/receivables'),
    },
    lowStockCount > 0 && {
      key: 'lowStock',
      severity: outOfStockCount > 0 ? 'high' : 'medium',
      icon: <PackageOpen size={18} />,
      label: t('dashboard.attention.lowStock.label'),
      count: lowStockCount,
      hint: t('dashboard.attention.lowStock.hint'),
      cta: t('dashboard.attention.viewAction'),
      onClick: () => navigate('/admin/inventory'),
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
    pendingReturnsCount > 0 && {
      key: 'pendingReturns',
      severity: 'low',
      icon: <RotateCcw size={18} />,
      label: t('dashboard.attention.pendingReturns.label'),
      count: pendingReturnsCount,
      hint: t('dashboard.attention.pendingReturns.hint'),
      cta: t('dashboard.attention.viewAction'),
      onClick: () => navigate('/admin/returns'),
    },
  ]
    .filter(Boolean)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('dashboard.eyebrow')}</p>
          <h1>{t(`dashboard.${greetingKey}`, { name: firstName })}</h1>
          <p className="bb-muted">{t('dashboard.greetingDesc', { date: todayLabel })}</p>
        </div>
        <div className="bb-screen-actions">
          <div className="bb-seg" role="tablist" aria-label={t('dashboard.periodLabel')}>
            {periodTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={period === tab.key}
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
            <div className="bb-kpi clickable" onClick={() => navigate('/admin/reports')}>
              <div className="bb-kpi-head">
                <span>{t('dashboard.kpi.todayRevenue')}</span>
                <span className="bb-kpi-icon brand"><CircleDollarSign size={15} /></span>
              </div>
              <div className="bb-kpi-value">{formatVndShort(data.kpi.todayRevenue)}</div>
              <div className="bb-kpi-foot">
                <TrendPill {...revenueTrend(data.kpi)} />
                <span className="bb-kpi-foot-label">
                  {data.kpi.todayPaidRevenue != null
                    ? t('dashboard.kpi.todayPaid', { amount: formatVndShort(data.kpi.todayPaidRevenue) })
                    : t('dashboard.kpi.todayRevenueHint')}
                </span>
              </div>
            </div>

            <div className="bb-kpi clickable" onClick={() => navigate('/admin/orders')}>
              <div className="bb-kpi-head">
                <span>{t('dashboard.kpi.todayOrders')}</span>
                <span className="bb-kpi-icon info"><ShoppingBag size={15} /></span>
              </div>
              <div className="bb-kpi-value">{data.kpi.todayOrders.toLocaleString('vi-VN')}</div>
              <div className="bb-kpi-foot">
                <TrendPill {...ordersTrend(data.kpi)} />
                <span className="bb-kpi-foot-label">{t('dashboard.kpi.todayOrdersHint')}</span>
              </div>
            </div>

            <div className="bb-kpi clickable" onClick={() => navigate('/admin/orders')}>
              <div className="bb-kpi-head">
                <span>{t('dashboard.kpi.pendingOrders')}</span>
                <span className={`bb-kpi-icon ${data.kpi.pendingOrders > PENDING_WARN_THRESHOLD ? 'danger' : 'warning'}`}>
                  <Clock size={15} />
                </span>
              </div>
              <div className="bb-kpi-value">{data.kpi.pendingOrders.toLocaleString('vi-VN')}</div>
              <div className="bb-kpi-foot">
                <span className="bb-kpi-foot-label">{t('dashboard.kpi.pendingOrdersHint')}</span>
              </div>
            </div>

            <div className="bb-kpi clickable" onClick={() => navigate('/admin/products')}>
              <div className="bb-kpi-head">
                <span>{t('dashboard.kpi.activeProducts')}</span>
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
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={revenueData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--bb-brand)" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="var(--bb-brand)" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--bb-border-faint)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: 'var(--bb-text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        interval={Math.max(0, Math.floor(revenueData.length / 6))}
                        tickFormatter={fmtIsoDateShort}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--bb-text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={fmtAxisMillions}
                        width={40}
                      />
                      <Tooltip content={<RevenueTooltip ordersUnit={t('dashboard.revenueChart.ordersAxis')} />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name={t('dashboard.revenueChart.revenue')}
                        stroke="var(--bb-brand)"
                        strokeWidth={2}
                        fill="url(#grad-revenue)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
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
                  <button
                    type="button"
                    className="bb-btn bb-btn-ghost bb-btn-sm"
                    onClick={() => navigate('/admin/orders')}
                  >
                    {t('dashboard.orderStatusChart.viewAll')} →
                  </button>
                )}
              </div>
              <div className="bb-card-body">
                {pieTotal > 0 ? (
                  <div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieDataWithTotal}
                          cx="50%" cy="50%"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="name"
                        >
                          {pieDataWithTotal.map((entry) => (
                            <Cell key={entry.status} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip orderUnit={t('dashboard.orderStatusChart.orderUnit')} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                      {pieDataWithTotal.map((d) => (
                        <div
                          key={d.status}
                          onClick={() => navigate('/admin/orders')}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}
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
                      onClick={item.onClick}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') item.onClick() }}
                    >
                      <span className={`bb-attention-sev ${SEVERITY_TONE[item.severity]}`} />
                      <span className="bb-attention-icon" aria-hidden="true">{item.icon}</span>
                      <div className="bb-attention-body">
                        <div className="bb-attention-title">{item.label}</div>
                        <div className="bb-attention-desc">{item.hint}</div>
                      </div>
                      <span className="bb-attention-count">{item.count}</span>
                      <button
                        type="button"
                        className="bb-btn bb-btn-ghost bb-btn-sm"
                        onClick={(e) => { e.stopPropagation(); item.onClick() }}
                      >
                        {item.cta} →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent orders + top products */}
          <div className="bb-grid-2">
            <div className="bb-card">
              <div className="bb-card-header">
                <h3>{t('dashboard.recentOrders.title')}</h3>
                {recentOrders.length > 0 && (
                  <button
                    type="button"
                    className="bb-btn bb-btn-ghost bb-btn-sm"
                    onClick={() => navigate('/admin/orders')}
                  >
                    {t('dashboard.recentOrders.viewAll')} →
                  </button>
                )}
              </div>
              <div className="bb-card-body--flush">
                {recentOrders.length > 0 ? (
                  <div className="bb-table-wrap">
                    <table className="bb-table">
                      <thead>
                        <tr>
                          <th>{t('dashboard.recentOrders.orderNumber')}</th>
                          <th>{t('dashboard.recentOrders.customer')}</th>
                          <th className="num">{t('dashboard.recentOrders.total')}</th>
                          <th>{t('dashboard.recentOrders.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentOrders.map((order) => (
                          <tr key={order.id} onClick={() => navigate(`/admin/orders/${order.id}`)}>
                            <td className="mono">{order.orderNumber}</td>
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
                ) : (
                  <div className="bb-card-body">
                    <SectionEmpty
                      title={t('dashboard.recentOrders.empty')}
                      description={t('dashboard.recentOrders.emptyDesc')}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bb-card">
              <div className="bb-card-header">
                <h3>{t('dashboard.topProducts.title')}</h3>
                {topProducts.length > 0 && (
                  <button
                    type="button"
                    className="bb-btn bb-btn-ghost bb-btn-sm"
                    onClick={() => navigate('/admin/products')}
                  >
                    {t('dashboard.topProducts.viewAll')} →
                  </button>
                )}
              </div>
              <div className="bb-card-body--flush">
                {topProducts.length > 0 ? (
                  <div className="bb-table-wrap">
                    <table className="bb-table">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>{t('dashboard.topProducts.rank')}</th>
                          <th>{t('dashboard.topProducts.product')}</th>
                          <th className="num">{t('dashboard.topProducts.units')}</th>
                          <th className="num">{t('dashboard.topProducts.revenue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((product, idx) => (
                          <tr key={product.productId} onClick={() => navigate(`/admin/products/${product.productId}`)}>
                            <td>
                              <span className={`bb-rank${idx < 3 ? ` bb-rank-${idx + 1}` : ''}`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td>
                              <div className="bb-product-cell">
                                <span className="bb-product-thumb"><Package size={18} /></span>
                                <span title={product.name}>{product.name}</span>
                              </div>
                            </td>
                            <td className="num">{product.units}</td>
                            <td className="num" style={{ fontWeight: 700, color: 'var(--bb-brand)' }}>
                              {formatVndShort(product.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bb-card-body">
                    <SectionEmpty
                      title={t('dashboard.topProducts.empty')}
                      description={t('dashboard.topProducts.emptyDesc')}
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
