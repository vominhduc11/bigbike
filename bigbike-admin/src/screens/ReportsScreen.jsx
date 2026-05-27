import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Download } from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchAnalytics, exportOrdersCsv } from '../lib/adminApi'
import { formatCurrencyVnd } from '../lib/formatters'

const PRESET_VALUES = [
  { key: 'preset7d',  value: '7d',  days: 7 },
  { key: 'preset30d', value: '30d', days: 30 },
  { key: 'preset90d', value: '90d', days: 90 },
]

function RevenueTooltip({ active, payload, label, locale }) {
  if (!active || !payload?.length) return null
  return (
    <div className="dash-tooltip">
      <div className="dash-tooltip-date">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="dash-tooltip-row" style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'revenue' ? formatCurrencyVnd(p.value, locale) : p.value}
        </div>
      ))}
    </div>
  )
}

// Ranked table card — bb-* classes.
function RankTable({ title, rows, cols, noDataLabel }) {
  return (
    <div className="bb-card">
      <div className="bb-card-header"><h2>{title}</h2></div>
      <div className="bb-card-body bb-card-body--flush">
        <div className="bb-table-wrap">
          <table className="bb-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                {cols.map((c) => <th key={c.key} className={c.right ? 'num' : undefined}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length + 1} className="text-center bb-muted" style={{ fontSize: 14 }}>{noDataLabel}</td>
                </tr>
              ) : rows.map((row, idx) => (
                <tr key={idx}>
                  <td className="bb-muted">{idx + 1}</td>
                  {cols.map((c) => (
                    <td key={c.key} className={c.right ? 'num' : undefined}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function toLocalDateString(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export function ReportsScreen() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'

  const [preset, setPreset] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [state, setState] = useState({ status: 'loading', data: null, warning: '' })

  const resolvedDates = useCallback(() => {
    if (preset === 'custom') {
      return { from: customFrom, to: customTo }
    }
    const p = PRESET_VALUES.find((x) => x.value === preset) || PRESET_VALUES[1]
    return {
      from: toLocalDateString(p.days - 1),
      to: toLocalDateString(0),
    }
  }, [preset, customFrom, customTo])

  useEffect(() => {
    let active = true
    const { from, to } = resolvedDates()

    if (preset === 'custom' && from && to && from > to) {
      queueMicrotask(() => {
        if (active) setState({ status: 'error', data: null, warning: '', error: t('reports.dateRangeError') })
      })
      return () => { active = false }
    }

    queueMicrotask(() => {
      if (active) setState((s) => ({ ...s, status: 'loading' }))
    })
    fetchAnalytics(from, to)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', data: r.data, warning: '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', data: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [resolvedDates, preset, t])

  const { from: exportFrom, to: exportTo } = resolvedDates()
  const tickFmt = (v) => `${(v / 1000000).toFixed(0)}M`

  const presetTabs = [
    ...PRESET_VALUES.map((p) => ({ key: p.value, label: t(`reports.${p.key}`) })),
    { key: 'custom', label: t('reports.presetCustom') },
  ]

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('reports.eyebrow')}</p>
          <h1>{t('reports.title')}</h1>
          <p className="bb-muted">{t('reports.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <div className="bb-seg" role="tablist" aria-label={t('reports.title')}>
            {presetTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={preset === tab.key}
                className={preset === tab.key ? 'active' : ''}
                onClick={() => setPreset(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <>
              <input
                type="date"
                className="bb-input"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="bb-muted" style={{ alignSelf: 'center', fontSize: 14 }}>→</span>
              <input
                type="date"
                className="bb-input"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          )}
          <button
            type="button"
            className="bb-btn bb-btn-primary"
            onClick={() => exportOrdersCsv({ from: exportFrom, to: exportTo })}
          >
            <Download size={14} />{t('reports.exportOrders')}
          </button>
          {preset !== 'custom' && (
            <button type="button" className="bb-btn bb-btn-secondary" onClick={() => setPreset('custom')}>
              <Calendar size={14} />{t('reports.presetCustom')}
            </button>
          )}
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {state.status === 'loading' && (
        <StatePanel tone="info" title={t('reports.loading')} description={t('common.pleaseWait')} />
      )}

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('reports.loadError')} description={state.error} />
      )}

      {state.status === 'success' && state.data && (
        <>
          {/* KPI row */}
          <div className="bb-kpi-grid">
            {[
              { label: t('reports.kpiGmv'), value: formatCurrencyVnd(state.data.summary.grossOrderValue, locale), color: 'danger' },
              { label: t('reports.kpiPaidRevenue'), value: formatCurrencyVnd(state.data.summary.paidRevenue, locale), color: 'success' },
              { label: t('reports.kpiRefund'), value: formatCurrencyVnd(state.data.summary.refundAmount, locale), color: 'warning' },
              { label: t('reports.kpiNetRevenue'), value: formatCurrencyVnd(state.data.summary.netRevenue, locale), color: 'info' },
              { label: t('reports.kpiOrderCount'), value: state.data.summary.orderCount.toLocaleString(locale), color: 'info' },
              { label: t('reports.kpiAov'), value: formatCurrencyVnd(state.data.summary.avgOrderValue, locale), color: '' },
            ].map((k) => (
              <div className="bb-kpi" key={k.label}>
                <div className="bb-kpi-head"><span>{k.label}</span></div>
                <div className="bb-kpi-value">{k.value}</div>
              </div>
            ))}
          </div>

          {/* Revenue trend chart */}
          {state.data.dailyRevenue?.length > 1 && (
            <div className="bb-card mb-4">
              <div className="bb-card-header"><h2>{t('reports.chartDailyRevenue')}</h2></div>
              <div className="bb-card-body">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={state.data.dailyRevenue} margin={{ left: 10, right: 10, top: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--admin-color-brand-red)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="var(--admin-color-brand-red)" stopOpacity={0} />
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
                    <Tooltip content={<RevenueTooltip locale={locale} />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name={t('reports.chartRevenueSeries')}
                      stroke="var(--admin-color-brand-red)"
                      strokeWidth={2}
                      fill="url(#revenueGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top products bar chart */}
          {state.data.topProducts?.length > 0 && (
            <div className="bb-card mb-4">
              <div className="bb-card-header"><h2>{t('reports.chartTopProducts')}</h2></div>
              <div className="bb-card-body">
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
                      formatter={(v) => [formatCurrencyVnd(v, locale), t('reports.colRevenue')]}
                      cursor={{ fill: 'var(--admin-color-surface-hover)' }}
                    />
                    <Bar dataKey="revenue" fill="var(--admin-color-brand-red)" radius={[0, 3, 3, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tables row */}
          <div className="grid-2">
            <RankTable
              title={t('reports.chartTopProducts')}
              rows={state.data.topProducts}
              noDataLabel={t('reports.noData')}
              cols={[
                { key: 'productName', label: t('reports.colProduct') },
                { key: 'unitsSold', label: t('reports.colUnitsSold'), right: true },
                { key: 'revenue', label: t('reports.colRevenue'), right: true, render: (r) => formatCurrencyVnd(r.revenue, locale) },
              ]}
            />
            <RankTable
              title={t('reports.chartTopCustomers')}
              rows={state.data.topCustomers}
              noDataLabel={t('reports.noData')}
              cols={[
                { key: 'customerEmail', label: t('reports.colEmail') },
                { key: 'orderCount', label: t('reports.colOrders'), right: true },
                { key: 'revenue', label: t('reports.colSpend'), right: true, render: (r) => formatCurrencyVnd(r.revenue, locale) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  )
}
