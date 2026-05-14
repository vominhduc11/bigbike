import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CircleDollarSign,
  Clock,
  Package,
  PackageOpen,
  RotateCcw,
  ShoppingBag,
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
import {
  fetchDashboardSummary,
  fetchReceivableSummary,
  fetchInventorySummary,
  fetchReturns,
} from '../lib/adminApi'
import { Badge } from '@/components/ui/badge'
import {
  Screen,
  ScreenHeader,
  SummaryCard,
  SummaryCardGrid,
  Tabs,
} from '../components/layout'

const PENDING_WARN_THRESHOLD = 5

const ORDER_STATUS_TONES = {
  PENDING:    'warning',
  ON_HOLD:    'neutral',
  PROCESSING: 'info',
  COMPLETED:  'success',
  CANCELLED:  'danger',
  FAILED:     'danger',
  REFUNDED:   'neutral',
}

const ORDER_STATUS_COLORS = {
  PENDING:    '#92400e',
  ON_HOLD:    '#6b7280',
  PROCESSING: '#1d4ed8',
  COMPLETED:  '#15803d',
  CANCELLED:  '#b91c1c',
  FAILED:     '#b91c1c',
  REFUNDED:   '#6b7280',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMillions(value) {
  if (!value && value !== 0) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}K`
  return value.toString()
}

function fmtVndCompact(value) {
  if (!value && value !== 0) return '—'
  return new Intl.NumberFormat('vi-VN').format(value) + ' ₫'
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
          {p.name}: {p.dataKey === 'revenue' ? fmtVndCompact(p.value) : `${p.value} ${ordersUnit}`}
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

function OrderStatusBadge({ status }) {
  const { t } = useTranslation()
  const tone = ORDER_STATUS_TONES[status] || 'neutral'
  return (
    <Badge variant={tone === 'neutral' ? 'muted' : tone}>
      {t(`status.order.${status}`, status)}
    </Badge>
  )
}

function SectionCard({ title, action, children }) {
  return (
    <section className="dash-section">
      <header className="dash-section-head">
        <span className="dash-section-title">{title}</span>
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

// ── Main screen ───────────────────────────────────────────────────────────────

export function DashboardScreen({ navigate }) {
  const { t } = useTranslation()
  const [period, setPeriod] = useState('30d')

  const { data: dashResult, isLoading, isError } = useQuery({
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
    queryFn: () => fetchReturns({ status: 'REQUESTED', page: 1, pageSize: 1 }),
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
        color: ORDER_STATUS_COLORS[d.status] ?? '#6b7280',
        total: pieTotal,
      }))
    : []

  // Attention items: only render the ones with count > 0.
  const pendingOrdersCount = data?.kpi.pendingOrders ?? 0
  const overdueCount = arSummary?.countOverdue ?? 0
  const overdueAmount = arSummary?.overdueOutstanding ?? 0
  const lowStockCount = (invSummary?.lowStockCount ?? 0) + (invSummary?.outOfStockCount ?? 0)
  const pendingReturnsCount = pendingReturns?.pagination?.total ?? 0

  const attentionItems = [
    pendingOrdersCount > 0 && {
      key: 'pendingOrders',
      tone: 'warning',
      icon: <Clock size={16} />,
      label: t('dashboard.attention.pendingOrders.label'),
      value: t('dashboard.attention.pendingOrders.value', { count: pendingOrdersCount }),
      hint: t('dashboard.attention.pendingOrders.hint'),
      onClick: () => navigate('/admin/orders'),
    },
    overdueCount > 0 && {
      key: 'overdueReceivables',
      tone: 'danger',
      icon: <AlertTriangle size={16} />,
      label: t('dashboard.attention.overdueReceivables.label'),
      value: t('dashboard.attention.overdueReceivables.value', { count: overdueCount }),
      hint: t('dashboard.attention.overdueReceivables.hint', { amount: fmtVndCompact(overdueAmount) }),
      onClick: () => navigate('/admin/receivables'),
    },
    pendingReturnsCount > 0 && {
      key: 'pendingReturns',
      tone: 'info',
      icon: <RotateCcw size={16} />,
      label: t('dashboard.attention.pendingReturns.label'),
      value: t('dashboard.attention.pendingReturns.value', { count: pendingReturnsCount }),
      hint: t('dashboard.attention.pendingReturns.hint'),
      onClick: () => navigate('/admin/returns'),
    },
    lowStockCount > 0 && {
      key: 'lowStock',
      tone: 'warning',
      icon: <PackageOpen size={16} />,
      label: t('dashboard.attention.lowStock.label'),
      value: t('dashboard.attention.lowStock.value', { count: lowStockCount }),
      hint: t('dashboard.attention.lowStock.hint'),
      onClick: () => navigate('/admin/inventory'),
    },
  ].filter(Boolean)

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
            ariaLabel={t('dashboard.title')}
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
          onAction={() => window.location.reload()}
        />
      )}

      {/* Skeleton — initial load only */}
      {state.status === 'loading' && !data && (
        <>
          <div className="dash-skeleton-grid">
            {[...Array(4)].map((_, i) => (
              <SkeletonBlock key={i} height={110} />
            ))}
          </div>
          <div className="dash-charts-grid">
            <SkeletonBlock height={300} />
            <SkeletonBlock height={300} />
          </div>
        </>
      )}

      {data && (
        <>
          {/* Attention section — always rendered; shows "all clear" if empty */}
          <section className="dash-section">
            <header className="dash-section-head">
              <div>
                <span className="dash-section-title">{t('dashboard.attention.title')}</span>
                <p className="dash-section-desc">{t('dashboard.attention.description')}</p>
              </div>
            </header>
            <div className="dash-section-body">
              {attentionItems.length === 0 ? (
                <StatePanel tone="success" title={t('dashboard.attention.empty')} />
              ) : (
                <SummaryCardGrid>
                  {attentionItems.map((item) => (
                    <SummaryCard
                      key={item.key}
                      tone={item.tone}
                      icon={item.icon}
                      label={item.label}
                      value={item.value}
                      hint={item.hint}
                      onClick={item.onClick}
                      ariaLabel={`${item.label}: ${item.value}. ${t('dashboard.attention.viewAction')}`}
                    />
                  ))}
                </SummaryCardGrid>
              )}
            </div>
          </section>

          {/* KPI cards — clickable shortcuts */}
          <SummaryCardGrid>
            <SummaryCard
              tone="brand"
              icon={<CircleDollarSign size={16} />}
              label={t('dashboard.kpi.todayRevenue')}
              value={fmtVndCompact(data.kpi.todayRevenue)}
              hint={
                data.kpi.todayPaidRevenue != null
                  ? t('dashboard.kpi.todayPaid', { amount: fmtVndCompact(data.kpi.todayPaidRevenue) })
                  : t('dashboard.kpi.todayRevenueHint')
              }
              onClick={() => navigate('/admin/reports')}
            />
            <SummaryCard
              tone="info"
              icon={<ShoppingBag size={16} />}
              label={t('dashboard.kpi.todayOrders')}
              value={data.kpi.todayOrders}
              hint={t('dashboard.kpi.todayOrdersHint')}
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

          {/* Charts row */}
          <div className="dash-charts-grid">
            <SectionCard title={t('dashboard.revenueChart.title')}>
              <div className="dash-chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.revenueData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--admin-color-brand-red)" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="var(--admin-color-brand-red)" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-color-border-subtle)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--admin-color-text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.floor(data.revenueData.length / 6)}
                      tickFormatter={fmtIsoDateShort}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--admin-color-text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={fmtMillions}
                      width={48}
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
            </SectionCard>

            <SectionCard
              title={t('dashboard.orderStatusChart.title')}
              action={<ViewAllLink label={t('dashboard.orderStatusChart.viewAll')} onClick={() => navigate('/admin/orders')} />}
            >
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
            </SectionCard>
          </div>

          {/* Tables row */}
          <div className="dash-tables-grid">
            <SectionCard
              title={t('dashboard.recentOrders.title')}
              action={<ViewAllLink label={t('dashboard.recentOrders.viewAll')} onClick={() => navigate('/admin/orders')} />}
            >
              <div className="table-wrap">
                <table className="admin-table dash-compact-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.recentOrders.orderNumber')}</th>
                      <th>{t('dashboard.recentOrders.customer')}</th>
                      <th>{t('dashboard.recentOrders.total')}</th>
                      <th>{t('dashboard.recentOrders.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                        className="table-row-clickable"
                      >
                        <td className="dash-cell-strong">{order.orderNumber}</td>
                        <td className="dash-cell-truncate">{order.customerName || order.customerEmail}</td>
                        <td className="dash-cell-strong">{fmtVndCompact(order.total)}</td>
                        <td><OrderStatusBadge status={order.orderStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title={t('dashboard.topProducts.title')}
              action={<ViewAllLink label={t('dashboard.topProducts.viewAll')} onClick={() => navigate('/admin/products')} />}
            >
              <div className="table-wrap">
                <table className="admin-table dash-compact-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.topProducts.rank')}</th>
                      <th>{t('dashboard.topProducts.product')}</th>
                      <th>{t('dashboard.topProducts.units')}</th>
                      <th>{t('dashboard.topProducts.revenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((product, idx) => (
                      <tr
                        key={product.productId}
                        onClick={() => navigate(`/admin/products/${product.productId}`)}
                        className="table-row-clickable"
                      >
                        <td>
                          <span className={`rank-badge rank-${idx < 3 ? idx + 1 : 'n'}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="dash-cell-product">{product.name}</td>
                        <td className="dash-cell-strong">{product.units}</td>
                        <td className="dash-cell-strong">{fmtMillions(product.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </Screen>
  )
}
