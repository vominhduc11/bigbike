import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CircleDollarSign, Clock, Package, ShoppingBag } from 'lucide-react'
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
import { fetchDashboardSummary } from '../lib/adminApi'

// Orders with >PENDING_WARN_THRESHOLD pending get a red sub-line on the KPI card
const PENDING_WARN_THRESHOLD = 5

// Tone mapping — matches real OrderStatus enum values only
const ORDER_STATUS_TONES = {
  PENDING:    'warning',
  ON_HOLD:    'neutral',
  PROCESSING: 'info',
  COMPLETED:  'success',
  CANCELLED:  'danger',
  FAILED:     'danger',
  REFUNDED:   'neutral',
}

// Pie chart fill colours (UI-only, never sent from BE)
const ORDER_STATUS_COLORS = {
  PENDING:    '#f59e0b',
  ON_HOLD:    '#6b7280',
  PROCESSING: '#8b5cf6',
  COMPLETED:  '#10b981',
  CANCELLED:  '#ef4444',
  FAILED:     '#ef4444',
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

// ISO "yyyy-MM-dd" → "29/4" for chart axis labels
function fmtIsoDateShort(isoDate) {
  if (!isoDate) return ''
  const [, m, d] = isoDate.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, subPositive, subNegative, sub2 }) {
  const subColor = subPositive
    ? 'var(--admin-color-status-success-text)'
    : subNegative
      ? 'var(--admin-color-status-danger-text)'
      : 'var(--admin-color-text-muted)'

  return (
    <div style={{
      background: 'var(--admin-color-surface-base)',
      border: '1px solid var(--admin-color-border-subtle)',
      borderRadius: 'var(--admin-radius-lg)',
      padding: '20px 24px',
      boxShadow: 'var(--admin-shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-text-muted)', fontWeight: 500 }}>
          {label}
        </span>
        <span style={{
          width: 36, height: 36,
          borderRadius: 'var(--admin-radius-md)',
          background: 'var(--admin-color-brand-red-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--admin-color-brand-red)',
          flexShrink: 0,
        }}>
          {icon}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 'var(--admin-text-2xl)', fontWeight: 700, color: 'var(--admin-color-text-primary)', lineHeight: 1.2 }}>
          {value}
        </div>
        {sub && (
          <div style={{ marginTop: 4, fontSize: 'var(--admin-text-xs)', color: subColor, fontWeight: 500 }}>
            {sub}
          </div>
        )}
        {sub2 && (
          <div style={{ marginTop: 2, fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', fontWeight: 400 }}>
            {sub2}
          </div>
        )}
      </div>
    </div>
  )
}

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--admin-color-surface-base)',
      border: '1px solid var(--admin-color-border-subtle)',
      borderRadius: 'var(--admin-radius-md)',
      padding: '10px 14px',
      boxShadow: 'var(--admin-shadow-md)',
      fontSize: 'var(--admin-text-sm)',
    }}>
      <div style={{ marginBottom: 4, color: 'var(--admin-color-text-muted)', fontWeight: 500 }}>
        {fmtIsoDateShort(label)}
      </div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: 'var(--admin-color-text-primary)', fontWeight: 600 }}>
          {p.name}: {p.dataKey === 'revenue' ? fmtVndCompact(p.value) : p.value + ' đơn'}
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const total = d.payload?.total || 1
  const pct = Math.round((d.value / total) * 100)
  return (
    <div style={{
      background: 'var(--admin-color-surface-base)',
      border: '1px solid var(--admin-color-border-subtle)',
      borderRadius: 'var(--admin-radius-md)',
      padding: '10px 14px',
      boxShadow: 'var(--admin-shadow-md)',
      fontSize: 'var(--admin-text-sm)',
    }}>
      <div style={{ fontWeight: 600, color: 'var(--admin-color-text-primary)' }}>{d.name}</div>
      <div style={{ color: 'var(--admin-color-text-muted)', marginTop: 2 }}>
        {d.value} đơn ({pct}%)
      </div>
    </div>
  )
}

function OrderStatusBadge({ status }) {
  const { t } = useTranslation()
  const tone = ORDER_STATUS_TONES[status] || 'neutral'
  return (
    <span className={`status-badge status-${tone}`}>
      {t(`status.order.${status}`, status)}
    </span>
  )
}

function SectionCard({ title, action, children }) {
  return (
    <div style={{
      background: 'var(--admin-color-surface-base)',
      border: '1px solid var(--admin-color-border-subtle)',
      borderRadius: 'var(--admin-radius-lg)',
      boxShadow: 'var(--admin-shadow-sm)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1.5px solid var(--admin-color-border-subtle)',
        background: 'var(--admin-color-surface-muted)',
      }}>
        <span style={{ fontWeight: 700, fontSize: 'var(--admin-text-base)', color: 'var(--admin-color-text-primary)' }}>
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  )
}

function SkeletonBlock({ height = 280 }) {
  return (
    <div style={{
      height,
      borderRadius: 'var(--admin-radius-lg)',
      background: 'var(--admin-color-surface-base)',
      border: '1px solid var(--admin-color-border-subtle)',
      animation: 'pulse 1.4s ease-in-out infinite',
    }} />
  )
}

const IconRevenue  = () => <CircleDollarSign size={18} />
const IconOrders   = () => <ShoppingBag size={18} />
const IconPending  = () => <Clock size={18} />
const IconProducts = () => <Package size={18} />

// ── Main screen ───────────────────────────────────────────────────────────────

export function DashboardScreen({ navigate }) {
  const { t } = useTranslation()
  const [period, setPeriod] = useState('30d')

  const { data: dashResult, isLoading, isError } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => fetchDashboardSummary(period),
    staleTime: 60_000,
  })

  const state = {
    status: isLoading ? 'loading' : isError ? 'error' : 'ok',
    data: dashResult?.data ?? null,
    isMock: dashResult?.isMock ?? false,
  }
  const { data } = state

  const periodOptions = [
    { value: '7d',  label: t('dashboard.period7d')  },
    { value: '30d', label: t('dashboard.period30d') },
    { value: '90d', label: t('dashboard.period90d') },
  ]

  const pieTotal = data
    ? data.orderStatusBreakdown.reduce((s, d) => s + d.count, 0)
    : 0

  const pieDataWithTotal = data
    ? data.orderStatusBreakdown.map((d) => ({
        ...d,
        name: t(`status.order.${d.status}`, d.status),
        color: ORDER_STATUS_COLORS[d.status] ?? '#9ca3af',
        total: pieTotal,
      }))
    : []

  return (
    <div className="dash-page">

      {/* Page header */}
      <div className="dash-header">
        <div>
          <div style={{ fontSize: 'var(--admin-text-xs)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-color-brand-red)', marginBottom: 4 }}>
            {t('dashboard.eyebrow')}
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--admin-text-xl)', fontWeight: 800, color: 'var(--admin-color-text-primary)', lineHeight: 1.2 }}>
            {t('dashboard.title')}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--admin-text-sm)', color: 'var(--admin-color-text-muted)' }}>
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--admin-color-surface-muted)', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 'var(--admin-radius-md)', padding: 3 }}>
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              style={{
                padding: '5px 14px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--admin-text-sm)',
                fontWeight: 600,
                transition: 'var(--admin-transition-fast)',
                background: period === opt.value ? 'var(--admin-color-surface-base)' : 'transparent',
                color: period === opt.value ? 'var(--admin-color-text-primary)' : 'var(--admin-color-text-muted)',
                boxShadow: period === opt.value ? 'var(--admin-shadow-xs)' : 'none',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {state.isMock && (
        <div style={{ marginBottom: 16 }}>
          <StatePanel tone="warning" title={t('readOnly.prefix')} description={t('dashboard.mockWarning')} />
        </div>
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
          <div className="dash-tables-grid">
            <SkeletonBlock height={260} />
            <SkeletonBlock height={260} />
          </div>
        </>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="dash-kpi-grid">
            <KpiCard
              icon={<IconRevenue />}
              label={t('dashboard.kpi.todayRevenue')}
              value={fmtVndCompact(data.kpi.todayRevenue)}
              sub={
                data.kpi.todayRevenuePct > 0
                  ? `▲ ${data.kpi.todayRevenuePct}% ${t('dashboard.kpi.vsPrev')}`
                  : data.kpi.todayRevenuePct < 0
                    ? `▼ ${Math.abs(data.kpi.todayRevenuePct)}% ${t('dashboard.kpi.vsPrev')}`
                    : undefined
              }
              subPositive={data.kpi.todayRevenuePct > 0}
              subNegative={data.kpi.todayRevenuePct < 0}
              sub2={
                data.kpi.todayPaidRevenue != null
                  ? `Đã thu: ${fmtVndCompact(data.kpi.todayPaidRevenue)}`
                  : undefined
              }
            />
            <KpiCard
              icon={<IconOrders />}
              label={t('dashboard.kpi.todayOrders')}
              value={data.kpi.todayOrders}
              sub={
                data.kpi.todayOrdersDelta > 0
                  ? `+${data.kpi.todayOrdersDelta} ${t('dashboard.kpi.newVsPrev')}`
                  : data.kpi.todayOrdersDelta < 0
                    ? `${data.kpi.todayOrdersDelta} ${t('dashboard.kpi.newVsPrev')}`
                    : undefined
              }
              subPositive={data.kpi.todayOrdersDelta > 0}
              subNegative={data.kpi.todayOrdersDelta < 0}
            />
            <KpiCard
              icon={<IconPending />}
              label={t('dashboard.kpi.pendingOrders')}
              value={data.kpi.pendingOrders}
              sub={data.kpi.pendingOrders > 0 ? t('dashboard.kpi.awaitingAction') : undefined}
              subNegative={data.kpi.pendingOrders > PENDING_WARN_THRESHOLD}
            />
            <KpiCard
              icon={<IconProducts />}
              label={t('dashboard.kpi.activeProducts')}
              value={data.kpi.activeProducts}
              sub={t('dashboard.kpi.published')}
            />
          </div>

          {/* Charts row */}
          <div className="dash-charts-grid">

            {/* Revenue area chart */}
            <SectionCard title={t('dashboard.revenueChart.title')}>
              <div style={{ padding: '20px 8px 8px' }}>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.revenueData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e8281e" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#e8281e" stopOpacity={0.01} />
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
                    <Tooltip content={<RevenueTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name={t('dashboard.revenueChart.revenue')}
                      stroke="#e8281e"
                      strokeWidth={2}
                      fill="url(#grad-revenue)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* Order status pie */}
            <SectionCard title={t('dashboard.orderStatusChart.title')}>
              <div style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
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
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ width: '100%', padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pieDataWithTotal.map((d) => (
                    <div key={d.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--admin-text-xs)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--admin-color-text-secondary)' }}>{d.name}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--admin-color-text-primary)' }}>
                        {d.count} <span style={{ fontWeight: 400, color: 'var(--admin-color-text-muted)' }}>({pieTotal > 0 ? Math.round((d.count / pieTotal) * 100) : 0}%)</span>
                      </span>
                    </div>
                  ))}
                  <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--admin-color-border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--admin-text-xs)' }}>
                    <span style={{ color: 'var(--admin-color-text-muted)' }}>{t('dashboard.orderStatusChart.total')}</span>
                    <span style={{ fontWeight: 700, color: 'var(--admin-color-text-primary)' }}>{pieTotal}</span>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Tables row */}
          <div className="dash-tables-grid">

            {/* Recent orders */}
            <SectionCard
              title={t('dashboard.recentOrders.title')}
              action={
                <button
                  onClick={() => navigate('/admin/orders')}
                  style={{ fontSize: 'var(--admin-text-xs)', fontWeight: 600, color: 'var(--admin-color-brand-red)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                >
                  {t('dashboard.recentOrders.viewAll')} →
                </button>
              }
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--admin-text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--admin-color-border-subtle)' }}>
                    {[
                      t('dashboard.recentOrders.orderNumber'),
                      t('dashboard.recentOrders.customer'),
                      t('dashboard.recentOrders.total'),
                      t('dashboard.recentOrders.status'),
                    ].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/admin/orders/${order.id}`)}
                      className="dash-hoverable-row"
                    >
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--admin-color-brand-red)', whiteSpace: 'nowrap' }}>
                        {order.orderNumber}
                      </td>
                      <td style={{ padding: '11px 16px', color: 'var(--admin-color-text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.customerName || order.customerEmail}
                      </td>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--admin-color-text-primary)', whiteSpace: 'nowrap' }}>
                        {fmtVndCompact(order.total)}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <OrderStatusBadge status={order.orderStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>

            {/* Top products */}
            <SectionCard
              title={t('dashboard.topProducts.title')}
              action={
                <button
                  onClick={() => navigate('/admin/products')}
                  style={{ fontSize: 'var(--admin-text-xs)', fontWeight: 600, color: 'var(--admin-color-brand-red)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                >
                  {t('dashboard.topProducts.viewAll')} →
                </button>
              }
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--admin-text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--admin-color-border-subtle)' }}>
                    {[
                      '#',
                      t('dashboard.topProducts.product'),
                      t('dashboard.topProducts.units'),
                      t('dashboard.topProducts.revenue'),
                    ].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((product, idx) => (
                    <tr
                      key={product.productId}
                      onClick={() => navigate(`/admin/products/${product.productId}`)}
                      className="dash-hoverable-row"
                    >
                      <td style={{ padding: '11px 16px', width: 32 }}>
                        <span className={`rank-badge rank-${idx < 3 ? idx + 1 : 'n'}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--admin-color-text-primary)', fontSize: 'var(--admin-text-sm)', lineHeight: 1.3 }}>
                          {product.name}
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--admin-color-text-primary)', whiteSpace: 'nowrap' }}>
                        {product.units}
                      </td>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--admin-color-text-primary)', whiteSpace: 'nowrap' }}>
                        {fmtMillions(product.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          </div>
        </>
      )}

    </div>
  )
}
