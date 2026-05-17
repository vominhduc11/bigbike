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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const PRESET_VALUES = [
  { key: 'preset7d',  value: '7d',  days: 7 },
  { key: 'preset30d', value: '30d', days: 30 },
  { key: 'preset90d', value: '90d', days: 90 },
]

function KpiCard({ label, value }) {
  return (
    <div className="bg-surface-raised border border-border rounded-md px-5 py-4 flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground m-0">{label}</p>
      <p className="text-2xl font-bold m-0">{value}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-surface-raised border border-border rounded-md overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-border font-semibold text-sm">
        {title}
      </div>
      <div className="px-2 pt-4 pb-2">
        {children}
      </div>
    </div>
  )
}

function RevenueTooltip({ active, payload, label, locale }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-md px-3 py-2 shadow-md text-xs">
      <div className="font-semibold mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'revenue' ? formatCurrencyVnd(p.value, locale) : p.value}
        </div>
      ))}
    </div>
  )
}

function RankTable({ title, rows, cols, noDataLabel }) {
  return (
    <div className="table-wrap flex-1">
      <p className="px-4 py-3 font-semibold border-b border-border m-0">{title}</p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            {cols.map((c) => <th key={c.key} className={c.right ? 'align-right' : undefined}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length + 1} className="text-center text-muted-foreground text-sm">{noDataLabel}</td></tr>
          ) : rows.map((row, idx) => (
            <tr key={idx}>
              <td className="text-muted-foreground w-9">{idx + 1}</td>
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
        setState({ status: 'success', data: r.data, warning: r.mode === 'mock' ? r.warning : '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', data: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [resolvedDates, preset, t])

  const { from: exportFrom, to: exportTo } = resolvedDates()

  const tickFmt = (v) => `${(v / 1000000).toFixed(0)}M`

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('reports.eyebrow')}</p>
          <h1>{t('reports.title')}</h1>
          <p>{t('reports.description')}</p>
        </div>
        <ExportButton
          label={t('reports.exportOrders')}
          filename={`orders_${exportFrom}_${exportTo}.csv`}
          onExport={() => exportOrdersCsv({ from: exportFrom, to: exportTo })}
        />
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {/* Date range controls */}
      <div className="flex gap-2 flex-wrap mb-5 items-center">
        {PRESET_VALUES.map((p) => (
          <Button
            key={p.value}
            variant={preset === p.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPreset(p.value)}
          >
            {t(`reports.${p.key}`)}
          </Button>
        ))}
        <Button
          variant={preset === 'custom' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPreset('custom')}
        >
          {t('reports.presetCustom')}
        </Button>
        {preset === 'custom' && (
          <>
            <Input
              type="date"
              className="text-sm"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
             />
            <span className="text-muted-foreground">→</span>
            <Input
              type="date"
              className="text-sm"
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
          <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            <KpiCard label={t('reports.kpiGmv')} value={formatCurrencyVnd(state.data.summary.grossOrderValue, locale)} />
            <KpiCard label={t('reports.kpiPaidRevenue')} value={formatCurrencyVnd(state.data.summary.paidRevenue, locale)} />
            <KpiCard label={t('reports.kpiRefund')} value={formatCurrencyVnd(state.data.summary.refundAmount, locale)} />
            <KpiCard label={t('reports.kpiNetRevenue')} value={formatCurrencyVnd(state.data.summary.netRevenue, locale)} />
            <KpiCard label={t('reports.kpiOrderCount')} value={state.data.summary.orderCount.toLocaleString(locale)} />
            <KpiCard label={t('reports.kpiAov')} value={formatCurrencyVnd(state.data.summary.avgOrderValue, locale)} />
          </div>

          {/* Revenue trend chart */}
          {state.data.dailyRevenue?.length > 1 && (
            <ChartCard title={t('reports.chartDailyRevenue')}>
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
            </ChartCard>
          )}

          {/* Top products bar chart */}
          {state.data.topProducts?.length > 0 && (
            <ChartCard title={t('reports.chartTopProducts')}>
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
            </ChartCard>
          )}

          {/* Tables row */}
          <div className="flex gap-4 flex-wrap">
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
    </section>
  )
}
