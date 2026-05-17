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
import {
  fetchDashboardSummary,
  fetchReceivableSummary,
  fetchInventorySummary,
  fetchReturns,
} from '../lib/adminApi'
import {
  Screen,
  ScreenHeader,
  SummaryCard,
  SummaryCardGrid,
  Tabs,
} from '../components/layout'

const PENDING_WARN_THRESHOLD = 5

// Pie/legend colors reference the design tokens so the chart follows
// light/dark theme instead of carrying hardcoded hex values.
const ORDER_STATUS_COLORS = {
  PENDING:    'var(--admin-color-status-warning-text)',
  ON_HOLD:    'var(--admin-color-text-muted)',
  PROCESSING: 'var(--admin-color-status-info-text)',
  COMPLETED:  'var(--admin-color-status-success-text)',
  CANCELLED:  'var(--admin-color-status-danger-text)',
  FAILED:     'var(--admin-color-status-danger-text)',
  REFUNDED:   'var(--admin-color-text-muted)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Chart Y-axis: revenue values are scaled to millions so the axis stays readable.
function fmtAxisMillions(value) {
  if (!value && value !== 0) return ''
  return (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)
}

function fmtIsoDateShort(isoDate) {
  if (!isoDate) return ''
  const [, m, d] = isoDate.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label, ordersUnit }) {
  if (!active || !payload?.length) return null
  return (
    <div className="dash-tooltip">
      <div className="dash-tooltip-date">{fmtIsoDateShort(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="dash-tooltip-row">
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
    <div className="dash-tooltip">
      <div className="dash-tooltip-name">{d.name}</div>
      <div className="dash-tooltip-meta">
        {d.value} {orderUnit} ({pct}%)
      </div>
    </div>
  )
}

// Trend pill — shown under a KPI value. Renders a clear "no data" fallback
// rather than fabricating a number when the backend sends null.
function TrendPill({ direction, label }) {
  const icon =
    direction === 'up' ? <TrendingUp size={13} /> :
    direction === 'down' ? <TrendingDown size={13} /> :
    <Minus size={13} />
  return (
    <span className={`dash-trend dash-trend--${direction}`}>
      <span aria-hidden="true" className="dash-trend-icon">{icon}</span>
      <span>{label}</span>
    </span>
  )
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <section className="dash-section">
      <header className="dash-section-head">
        <div>
          <span className="dash-section-title">{title}</span>
          {subtitle ? <p className="dash-section-desc">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function ViewAllLink({ label, onClick }) {
  return (
    <button type="button" className="dash-view-all" onClick={onClick}>
      {label} →
    </button>
  )
}

function SkeletonBlock({ height = 280 }) {
  return <div className="dash-skeleton-block" style={{ height }} />
}

// Inline empty state for section cards — keeps the card framing so the
// dashboard never looks like a broken/error screen.
function SectionEmpty({ title, description }) {
  return (
    <div className="dash-empty">
      <p className="dash-empty-title">{title}</p>
      {description ? <p className="dash-empty-desc">{description}</p> : null}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function DashboardScreen({ navigate }) {
  const { t } = useTranslation()
  const [period, setPeriod] = useState('30d')

  const { data: dashResult, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => fetchDashboardSummary(period),
    staleTime: 60_000,
  })

  // Side-fetches for the "attention" section. Each is independent and tolerates
  // failure (returns 0). Cache keys match Receivables/Inventory/Returns screens
  // so visiting Dashboard warms their caches and vice-versa.
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
    isMock: dashResult?.isMock ?? false,
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

  // ── KPI trend resolution — uses backend-provided fields only ────────────────
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

  // Attention items: only render the ones with count > 0.
  const pendingOrdersCount = data?.kpi.pendingOrders ?? 0
  const overdueCount = arSummary?.countOverdue ?? 0
  const overdueAmount = arSummary?.overdueOutstanding ?? 0
  const lowStockCount = (invSummary?.lowStockCount ?? 0) + (invSummary?.outOfStockCount ?? 0)
  const outOfStockCount = invSummary?.outOfStockCount ?? 0
  const pendingReturnsCount = pendingReturns?.pagination?.totalItems ?? 0

  // severity drives color + sort order so the most urgent item sits first.
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
      onClick: () => navigate('/admin/receivables'),
    },
    lowStockCount > 0 && {
      key: 'lowStock',
      // Out-of-stock is urgent; only low-stock warnings are medium.
      severity: outOfStockCount > 0 ? 'high' : 'medium',
      icon: <PackageOpen size={18} />,
      label: t('dashboard.attention.lowStock.label'),
      count: lowStockCount,
      hint: t('dashboard.attention.lowStock.hint'),
      onClick: () => navigate('/admin/inventory'),
    },
    pendingOrdersCount > 0 && {
      key: 'pendingOrders',
      severity: pendingOrdersCount > PENDING_WARN_THRESHOLD ? 'high' : 'medium',
      icon: <Clock size={18} />,
      label: t('dashboard.attention.pendingOrders.label'),
      count: pendingOrdersCount,
      hint: t('dashboard.attention.pendingOrders.hint'),
      onClick: () => navigate('/admin/orders'),
    },
    pendingReturnsCount > 0 && {
      key: 'pendingReturns',
      severity: 'low',
      icon: <RotateCcw size={18} />,
      label: t('dashboard.attention.pendingReturns.label'),
      count: pendingReturnsCount,
      hint: t('dashboard.attention.pendingReturns.hint'),
      onClick: () => navigate('/admin/returns'),
    },
  ]
    .filter(Boolean)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        description={t('dashboard.subtitle')}
        actions={
          <Tabs
            items={periodTabs}
            value={period}
            onChange={setPeriod}
            ariaLabel={t('dashboard.periodLabel')}
          />
        }
      />

      {state.isMock && (
        <StatePanel tone="warning" title={t('readOnly.prefix')} description={t('dashboard.mockWarning')} />
      )}

      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('common.error')}
          description={t('dashboard.loadError')}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      )}

      {/* Skeleton — initial load only */}
      {state.status === 'loading' && !data && (
        <>
          <div className="dash-skeleton-grid">
            {[...Array(4)].map((_, i) => (
              <SkeletonBlock key={i} height={120} />
            ))}
          </div>
          <SkeletonBlock height={84} />
          <div className="dash-charts-grid">
            <SkeletonBlock height={300} />
            <SkeletonBlock height={300} />
          </div>
        </>
      )}

      {data && (
        <>
          {/* KPI cards — above the fold, with trend vs previous day */}
          <SummaryCardGrid>
            <SummaryCard
              tone="brand"
              icon={<CircleDollarSign size={16} />}
              label={t('dashboard.kpi.todayRevenue')}
              value={formatVndShort(data.kpi.todayRevenue)}
              hint={
                data.kpi.todayPaidRevenue != null
                  ? t('dashboard.kpi.todayPaid', { amount: formatVndShort(data.kpi.todayPaidRevenue) })
                  : t('dashboard.kpi.todayRevenueHint')
              }
              trend={<TrendPill {...revenueTrend(data.kpi)} />}
              onClick={() => navigate('/admin/reports')}
            />
            <SummaryCard
              tone="info"
              icon={<ShoppingBag size={16} />}
              label={t('dashboard.kpi.todayOrders')}
              value={data.kpi.todayOrders}
              hint={t('dashboard.kpi.todayOrdersHint')}
              trend={<TrendPill {...ordersTrend(data.kpi)} />}
              onClick={() => navigate('/admin/orders')}
            />
            <SummaryCard
              tone={data.kpi.pendingOrders > PENDING_WARN_THRESHOLD ? 'danger' : 'warning'}
              icon={<Clock size={16} />}
              label={t('dashboard.kpi.pendingOrders')}
              value={data.kpi.pendingOrders}
              hint={t('dashboard.kpi.pendingOrdersHint')}
              onClick={() => navigate('/admin/orders')}
            />
            <SummaryCard
              tone="success"
              icon={<Package size={16} />}
              label={t('dashboard.kpi.activeProducts')}
              value={data.kpi.activeProducts}
              hint={t('dashboard.kpi.activeProductsHint')}
              onClick={() => navigate('/admin/products')}
            />
          </SummaryCardGrid>

          {/* Attention — compact action items with severity */}
          <section className="dash-section">
            <header className="dash-section-head">
              <div>
                <span className="dash-section-title">{t('dashboard.attention.title')}</span>
                <p className="dash-section-desc">{t('dashboard.attention.description')}</p>
              </div>
            </header>
            <div className="dash-section-body">
              {attentionItems.length === 0 ? (
                <SectionEmpty
                  title={t('dashboard.attention.empty')}
                  description={t('dashboard.attention.emptyDesc')}
                />
              ) : (
                <ul className="dash-attention-list">
                  {attentionItems.map((item) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        className={`dash-attention-item dash-attention-item--${SEVERITY_TONE[item.severity]}`}
                        onClick={item.onClick}
                        aria-label={`${item.label}: ${item.count}. ${t('dashboard.attention.viewAction')}`}
                      >
                        <span className="dash-attention-icon" aria-hidden="true">{item.icon}</span>
                        <span className="dash-attention-body">
                          <span className="dash-attention-row">
                            <span className="dash-attention-label">{item.label}</span>
                            <span className={`dash-attention-sev dash-attention-sev--${SEVERITY_TONE[item.severity]}`}>
                              {t(`dashboard.attention.severity${item.severity === 'high' ? 'High' : item.severity === 'medium' ? 'Medium' : 'Low'}`)}
                            </span>
                          </span>
                          <span className="dash-attention-hint">{item.hint}</span>
                        </span>
                        <span className="dash-attention-count">{item.count}</span>
                        <span className="dash-attention-cta" aria-hidden="true">
                          {t('dashboard.attention.viewAction')} →
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Charts row */}
          <div className="dash-charts-grid">
            <SectionCard
              title={t('dashboard.revenueChart.title')}
              subtitle={t('dashboard.revenueChart.subtitle')}
            >
              {hasRevenue ? (
                <div className="dash-chart-box">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={revenueData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--admin-color-brand-red)" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="var(--admin-color-brand-red)" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-color-border-subtle)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: 'var(--admin-color-text-secondary)' }}
                        tickLine={false}
                        axisLine={false}
                        interval={Math.max(0, Math.floor(revenueData.length / 6))}
                        tickFormatter={fmtIsoDateShort}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--admin-color-text-secondary)' }}
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
                        stroke="var(--admin-color-brand-red)"
                        strokeWidth={2}
                        fill="url(#grad-revenue)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <SectionEmpty
                  title={t('dashboard.revenueChart.empty')}
                  description={t('dashboard.revenueChart.emptyDesc')}
                />
              )}
            </SectionCard>

            <SectionCard
              title={t('dashboard.orderStatusChart.title')}
              action={
                pieTotal > 0
                  ? <ViewAllLink label={t('dashboard.orderStatusChart.viewAll')} onClick={() => navigate('/admin/orders')} />
                  : null
              }
            >
              {pieTotal > 0 ? (
                <div className="dash-pie-box">
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
                  <div className="dash-pie-legend">
                    {pieDataWithTotal.map((d) => (
                      <button
                        key={d.status}
                        type="button"
                        className="dash-pie-legend-row"
                        onClick={() => navigate('/admin/orders')}
                      >
                        <span className="dash-pie-legend-label">
                          <span className="dash-pie-legend-dot" style={{ background: d.color }} />
                          <span>{d.name}</span>
                        </span>
                        <span className="dash-pie-legend-count">
                          {d.count}
                          <span className="dash-pie-legend-pct">
                            ({pieTotal > 0 ? Math.round((d.count / pieTotal) * 100) : 0}%)
                          </span>
                        </span>
                      </button>
                    ))}
                    <div className="dash-pie-legend-total">
                      <span>{t('dashboard.orderStatusChart.total')}</span>
                      <strong>{pieTotal}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <SectionEmpty title={t('dashboard.orderStatusChart.empty')} />
              )}
            </SectionCard>
          </div>

          {/* Tables row */}
          <div className="dash-tables-grid">
            <SectionCard
              title={t('dashboard.recentOrders.title')}
              action={
                recentOrders.length > 0
                  ? <ViewAllLink label={t('dashboard.recentOrders.viewAll')} onClick={() => navigate('/admin/orders')} />
                  : null
              }
            >
              {recentOrders.length > 0 ? (
                <div className="dash-table-wrap">
                  <table className="dash-table dash-table--orders">
                    <thead>
                      <tr>
                        <th>{t('dashboard.recentOrders.orderNumber')}</th>
                        <th>{t('dashboard.recentOrders.customer')}</th>
                        <th className="dash-col-num">{t('dashboard.recentOrders.total')}</th>
                        <th>{t('dashboard.recentOrders.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr
                          key={order.id}
                          onClick={() => navigate(`/admin/orders/${order.id}`)}
                          className="table-row-clickable"
                        >
                          <td className="dash-cell-strong">{order.orderNumber}</td>
                          <td
                            className="dash-cell-truncate"
                            title={order.customerName || order.customerEmail || ''}
                          >
                            {order.customerName || order.customerEmail}
                          </td>
                          <td className="dash-cell-strong dash-col-num">{formatVndShort(order.total)}</td>
                          <td><StatusBadge type="order" status={order.orderStatus} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <SectionEmpty
                  title={t('dashboard.recentOrders.empty')}
                  description={t('dashboard.recentOrders.emptyDesc')}
                />
              )}
            </SectionCard>

            <SectionCard
              title={t('dashboard.topProducts.title')}
              action={
                topProducts.length > 0
                  ? <ViewAllLink label={t('dashboard.topProducts.viewAll')} onClick={() => navigate('/admin/products')} />
                  : null
              }
            >
              {topProducts.length > 0 ? (
                <div className="dash-table-wrap">
                  <table className="dash-table dash-table--products">
                    <thead>
                      <tr>
                        <th className="dash-col-rank">{t('dashboard.topProducts.rank')}</th>
                        <th>{t('dashboard.topProducts.product')}</th>
                        <th className="dash-col-num">{t('dashboard.topProducts.units')}</th>
                        <th className="dash-col-num">{t('dashboard.topProducts.revenue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((product, idx) => (
                        <tr
                          key={product.productId}
                          onClick={() => navigate(`/admin/products/${product.productId}`)}
                          className="table-row-clickable"
                        >
                          <td className="dash-col-rank">
                            <span className={`rank-badge rank-${idx < 3 ? idx + 1 : 'n'}`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="dash-cell-product" title={product.name}>
                            {product.name}
                          </td>
                          <td className="dash-cell-strong dash-col-num">{product.units}</td>
                          <td className="dash-cell-strong dash-col-num">{formatVndShort(product.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <SectionEmpty
                  title={t('dashboard.topProducts.empty')}
                  description={t('dashboard.topProducts.emptyDesc')}
                />
              )}
            </SectionCard>
          </div>
        </>
      )}
    </Screen>
  )
}
