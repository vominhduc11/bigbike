import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area, AreaChart, Bar, BarChart,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ExportButton } from '../components/ExportButton'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchAnalytics, exportOrdersCsv } from '../lib/adminApi'
import { formatCurrencyVnd } from '../lib/formatters'

const PRESETS = [
  { label: '7 ngày', value: '7d', days: 7 },
  { label: '30 ngày', value: '30d', days: 30 },
  { label: '90 ngày', value: '90d', days: 90 },
]

function kpiStyle() {
  return {
    background: 'var(--admin-color-surface-raised)',
    border: '1px solid var(--admin-color-border-subtle)',
    borderRadius: 'var(--admin-radius-md)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }
}

function KpiCard({ label, value }) {
  return (
    <div style={kpiStyle()}>
      <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: 'var(--admin-color-surface-raised)',
      border: '1px solid var(--admin-color-border-subtle)',
      borderRadius: 'var(--admin-radius-md)',
      overflow: 'hidden',
      marginBottom: 20,
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--admin-color-border-subtle)',
        fontWeight: 600,
        fontSize: 'var(--admin-text-sm)',
      }}>
        {title}
      </div>
      <div style={{ padding: '16px 8px 8px' }}>
        {children}
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
      padding: '8px 12px',
      boxShadow: 'var(--admin-shadow-md)',
      fontSize: 'var(--admin-text-xs)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'revenue' ? formatCurrencyVnd(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

function RankTable({ title, rows, cols }) {
  return (
    <div className="table-wrap" style={{ flex: 1 }}>
      <p style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--admin-color-border-subtle)', margin: 0 }}>{title}</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            {cols.map((c) => <th key={c.key} className={c.right ? 'align-right' : undefined}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length + 1} style={{ textAlign: 'center', color: 'var(--admin-color-text-muted)', fontSize: '0.85rem' }}>Không có dữ liệu</td></tr>
          ) : rows.map((row, idx) => (
            <tr key={idx}>
              <td style={{ color: 'var(--admin-color-text-muted)', width: 36 }}>{idx + 1}</td>
              {cols.map((c) => (
                <td key={c.key} className={c.right ? 'align-right' : undefined}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function toLocalDateString(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export function ReportsScreen() {
  const { t } = useTranslation()
  const [preset, setPreset] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [state, setState] = useState({ status: 'loading', data: null, warning: '' })

  const resolvedDates = useCallback(() => {
    if (preset === 'custom') {
      return { from: customFrom, to: customTo }
    }
    const p = PRESETS.find((x) => x.value === preset) || PRESETS[1]
    return {
      from: toLocalDateString(p.days - 1),
      to: toLocalDateString(0),  // today — BE adds plusDays(1) for exclusive end
    }
  }, [preset, customFrom, customTo])

  useEffect(() => {
    let active = true
    const { from, to } = resolvedDates()

    // Block invalid custom range before hitting the server
    if (preset === 'custom' && from && to && from > to) {
      queueMicrotask(() => {
        if (active) setState({ status: 'error', data: null, warning: '', error: "'Từ ngày' không được sau 'Đến ngày'." })
      })
      return () => { active = false }
    }

    queueMicrotask(() => {
      if (active) setState((s) => ({ ...s, status: 'loading' }))
    })
    fetchAnalytics(from, to)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', data: r.data, warning: r.mode === 'mock' ? r.warning : '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', data: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [resolvedDates, preset])

  const { from: exportFrom, to: exportTo } = resolvedDates()

  const tickFmt = (v) => `${(v / 1000000).toFixed(0)}M`

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Phân tích</p>
          <h1>Báo cáo doanh thu</h1>
          <p>Doanh thu, sản phẩm và khách hàng theo khoảng thời gian</p>
        </div>
        <ExportButton
          label="Xuất đơn hàng (CSV)"
          filename={`orders_${exportFrom}_${exportTo}.csv`}
          onExport={() => exportOrdersCsv({ from: exportFrom, to: exportTo })}
        />
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {/* Date range controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={preset === p.value ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setPreset(p.value)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={preset === 'custom' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ fontSize: '0.8rem' }}
          onClick={() => setPreset('custom')}
        >
          Tuỳ chọn
        </button>
        {preset === 'custom' && (
          <>
            <input
              type="date"
              className="control-input"
              style={{ fontSize: '0.8rem' }}
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span style={{ color: 'var(--admin-color-text-muted)' }}>→</span>
            <input
              type="date"
              className="control-input"
              style={{ fontSize: '0.8rem' }}
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </>
        )}
      </div>

      {state.status === 'loading' && (
        <StatePanel tone="info" title={t('reports.loading')} description={t('common.pleaseWait')} />
      )}

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('reports.loadError')} description={state.error} />
      )}

      {state.status === 'success' && state.data && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            <KpiCard label="Doanh số (GMV)" value={formatCurrencyVnd(state.data.summary.grossOrderValue)} />
            <KpiCard label="Tiền thực thu" value={formatCurrencyVnd(state.data.summary.paidRevenue)} />
            <KpiCard label="Hoàn tiền" value={formatCurrencyVnd(state.data.summary.refundAmount)} />
            <KpiCard label="Doanh thu thuần" value={formatCurrencyVnd(state.data.summary.netRevenue)} />
            <KpiCard label="Số đơn hàng" value={state.data.summary.orderCount.toLocaleString('vi-VN')} />
            <KpiCard label="Giá trị đơn TB (AOV)" value={formatCurrencyVnd(state.data.summary.avgOrderValue)} />
          </div>

          {/* Revenue trend chart */}
          {state.data.dailyRevenue?.length > 1 && (
            <ChartCard title="Doanh thu theo ngày">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={state.data.dailyRevenue} margin={{ left: 10, right: 10, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e8281e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#e8281e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-color-border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--admin-color-text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={tickFmt}
                    tick={{ fontSize: 10, fill: 'var(--admin-color-text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Doanh thu"
                    stroke="#e8281e"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Top products bar chart */}
          {state.data.topProducts?.length > 0 && (
            <ChartCard title="Top sản phẩm theo doanh thu">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={state.data.topProducts.slice(0, 5)}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-color-border-subtle)" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={tickFmt}
                    tick={{ fontSize: 10, fill: 'var(--admin-color-text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="productName"
                    tick={{ fontSize: 10, fill: 'var(--admin-color-text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    width={140}
                    tickFormatter={(v) => v.length > 20 ? `${v.slice(0, 20)}…` : v}
                  />
                  <Tooltip
                    formatter={(v) => [formatCurrencyVnd(v), 'Doanh thu']}
                    cursor={{ fill: 'var(--admin-color-surface-hover)' }}
                  />
                  <Bar dataKey="revenue" fill="#e8281e" radius={[0, 3, 3, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Tables row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <RankTable
              title="Top sản phẩm theo doanh thu"
              rows={state.data.topProducts}
              cols={[
                { key: 'productName', label: 'Sản phẩm' },
                { key: 'unitsSold', label: 'SL bán', right: true },
                { key: 'revenue', label: 'Doanh thu', right: true, render: (r) => formatCurrencyVnd(r.revenue) },
              ]}
            />
            <RankTable
              title="Top khách hàng theo chi tiêu"
              rows={state.data.topCustomers}
              cols={[
                { key: 'customerEmail', label: 'Email' },
                { key: 'orderCount', label: 'Đơn', right: true },
                { key: 'revenue', label: 'Chi tiêu', right: true, render: (r) => formatCurrencyVnd(r.revenue) },
              ]}
            />
          </div>
        </>
      )}
    </section>
  )
}
