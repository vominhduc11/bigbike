import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calendar, Info, TrendingUp, TrendingDown, Minus,
  ChevronUp, ChevronDown, ChevronsUpDown,
  CircleDollarSign, Wallet, RotateCcw, PiggyBank, ShoppingBag, Receipt,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  Area, AreaChart, Bar, BarChart,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { ExportButton } from '../components/ExportButton'
import { fetchAnalytics, exportOrdersCsv, exportProductsCsv, exportCustomersCsv } from '../lib/adminApi'
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

// Mũi tên + % thay đổi so với kỳ trước cùng độ dài (.bb-kpi-trend up/down).
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

// Khối giữ chỗ khớp layout khi đang tải (thay panel chữ → không nhảy layout).
function SkeletonBlock({ height = 120 }) {
  return <div className="bb-skeleton-block" style={{ height }} />
}

// Ranked table card — bb-* classes; sort client-side trên cột số (top-N ≤ 1000 dòng).
function RankTable({ title, rows, cols, noDataLabel, sortLabel }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    const col = cols.find((c) => c.key === sortKey)
    if (!col?.sortable) return rows
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir
    })
  }, [rows, cols, sortKey, sortDir])

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="bb-card">
      <div className="bb-card-header"><h2>{title}</h2></div>
      <div className="bb-card-body bb-card-body--flush">
        <div className="bb-table-wrap">
          <table className="bb-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 36 }}>#</th>
                {cols.map((c) => {
                  if (!c.sortable) {
                    return (
                      <th key={c.key} scope="col" className={c.right ? 'num' : undefined}>{c.label}</th>
                    )
                  }
                  const active = sortKey === c.key
                  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      className={`sortable${active ? ' sorted' : ''}${c.right ? ' num' : ''}`}
                      aria-sort={ariaSort}
                      tabIndex={0}
                      role="button"
                      aria-label={sortLabel ? `${sortLabel}: ${c.label}` : c.label}
                      onClick={() => onSort(c.key)}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onSort(c.key) } }}
                    >
                      {c.label}
                      <span className="sort-ind" aria-hidden="true">
                        {active
                          ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
                          : <ChevronsUpDown size={12} />}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length + 1} className="text-center bb-muted" style={{ fontSize: 14 }}>{noDataLabel}</td>
                </tr>
              ) : sortedRows.map((row, idx) => (
                <tr key={row.id ?? idx}>
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

// Dịch khoảng ngày lùi về kỳ liền trước cùng độ dài (để so sánh kỳ-trên-kỳ).
function shiftRangeBack(from, to) {
  if (!from || !to) return { from: '', to: '' }
  const fromD = new Date(`${from}T00:00:00`)
  const toD = new Date(`${to}T00:00:00`)
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) return { from: '', to: '' }
  const spanDays = Math.round((toD - fromD) / 86400000) + 1
  const prevTo = new Date(fromD)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (spanDays - 1))
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  }
}

// % thay đổi giữa kỳ hiện tại và kỳ trước → {direction, label} cho TrendPill.
function makeTrend(current, previous, t) {
  if (previous == null) return { direction: 'neutral', label: t('reports.trendNoData', { defaultValue: 'Chưa có kỳ trước' }) }
  if (previous === 0) {
    if (current === 0) return { direction: 'neutral', label: t('reports.trendNoChange', { defaultValue: 'Không đổi' }) }
    return { direction: 'up', label: t('reports.trendNew', { defaultValue: 'Mới' }) }
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.round(pct * 10) / 10
  if (rounded === 0) return { direction: 'neutral', label: t('reports.trendNoChange', { defaultValue: 'Không đổi' }) }
  const sign = rounded > 0 ? '+' : ''
  return {
    direction: rounded > 0 ? 'up' : 'down',
    label: `${sign}${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
  }
}

export function ReportsScreen() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'

  const [preset, setPreset] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [state, setState] = useState({ status: 'loading', data: null, prev: null, warning: '' })

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
        if (active) setState({ status: 'error', data: null, prev: null, warning: '', error: t('reports.dateRangeError') })
      })
      return () => { active = false }
    }

    queueMicrotask(() => {
      if (active) setState((s) => ({ ...s, status: 'loading' }))
    })
    const prevRange = shiftRangeBack(from, to)
    // Lấy thêm kỳ liền trước để tính so sánh; lỗi kỳ trước không chặn hiển thị kỳ hiện tại.
    Promise.all([
      fetchAnalytics(from, to),
      prevRange.from && prevRange.to
        ? fetchAnalytics(prevRange.from, prevRange.to).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([r, prevR]) => {
        if (!active) return
        setState({ status: 'success', data: r.data, prev: prevR?.data ?? null, warning: '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', data: null, prev: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [resolvedDates, preset, t, retryKey])

  const { from: exportFrom, to: exportTo } = resolvedDates()
  const tickFmt = (v) => `${(v / 1000000).toFixed(0)}M`

  const rangeLabel = exportFrom && exportTo
    ? t('reports.rangeFromTo', { from: exportFrom, to: exportTo, defaultValue: 'Từ {{from}} đến {{to}}' })
    : ''

  const presetTabs = [
    ...PRESET_VALUES.map((p) => ({ key: p.value, label: t(`reports.${p.key}`) })),
    { key: 'custom', label: t('reports.presetCustom') },
  ]

  // Tải file CSV xuống máy + báo thành công/cảnh báo cắt dòng/lỗi qua toast.
  // ExportButton (N6) tự lo disable + spinner trong lúc chờ; ở đây lo phản hồi kết quả.
  const runExport = async (exportFn) => {
    try {
      const r = await exportFn()
      if (r?.truncated) toast.warning(t('export.truncated', { max: r.maxRows }))
      else toast.success(t('export.success'))
    } catch {
      toast.error(t('export.error'))
    }
  }

  // Mỗi KPI: nhãn + giá trị + icon màu semantic + gợi ý cách tính + delta kỳ-trên-kỳ.
  const kpiCards = state.data ? [
    {
      key: 'gmv',
      label: t('reports.kpiGmv'),
      value: formatCurrencyVnd(state.data.summary.grossOrderValue, locale),
      raw: state.data.summary.grossOrderValue,
      prev: state.prev?.summary.grossOrderValue,
      color: 'danger', money: true, icon: <CircleDollarSign size={15} />,
      hint: t('reports.kpiGmvHint', { defaultValue: 'Tổng giá trị các đơn đã đặt trong kỳ (chưa trừ hoàn tiền).' }),
    },
    {
      key: 'paid',
      label: t('reports.kpiPaidRevenue'),
      value: formatCurrencyVnd(state.data.summary.paidRevenue, locale),
      raw: state.data.summary.paidRevenue,
      prev: state.prev?.summary.paidRevenue,
      color: 'success', money: true, icon: <Wallet size={15} />,
      hint: t('reports.kpiPaidRevenueHint', { defaultValue: 'Số tiền thực sự đã thu được từ các đơn trong kỳ.' }),
    },
    {
      key: 'orders',
      label: t('reports.kpiOrderCount'),
      value: state.data.summary.orderCount.toLocaleString(locale),
      raw: state.data.summary.orderCount,
      prev: state.prev?.summary.orderCount,
      color: 'info', icon: <ShoppingBag size={15} />,
      hint: t('reports.kpiOrderCountHint', { defaultValue: 'Số đơn hàng phát sinh trong kỳ.' }),
    },
    {
      key: 'aov',
      label: t('reports.kpiAov'),
      value: formatCurrencyVnd(state.data.summary.avgOrderValue, locale),
      raw: state.data.summary.avgOrderValue,
      prev: state.prev?.summary.avgOrderValue,
      color: 'brand', money: true, icon: <Receipt size={15} />,
      hint: t('reports.kpiAovHint', { defaultValue: 'Giá trị trung bình mỗi đơn = doanh số chia số đơn.' }),
    },
  ] : []

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
                aria-label={t('reports.customFrom', { defaultValue: 'Từ ngày' })}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="bb-muted" aria-hidden="true" style={{ alignSelf: 'center', fontSize: 14 }}>→</span>
              <input
                type="date"
                className="bb-input"
                aria-label={t('reports.customTo', { defaultValue: 'Đến ngày' })}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          )}
          <ExportButton
            className="bb-btn bb-btn-primary"
            onExport={() => runExport(() => exportOrdersCsv({ from: exportFrom, to: exportTo }))}
          >
            {t('reports.exportOrders')}
          </ExportButton>
          <ExportButton
            title={t('reports.exportAllHint')}
            onExport={() => runExport(() => exportProductsCsv())}
          >
            {t('reports.exportProducts')}
          </ExportButton>
          <ExportButton
            title={t('reports.exportAllHint')}
            onExport={() => runExport(() => exportCustomersCsv())}
          >
            {t('reports.exportCustomers')}
          </ExportButton>
          {preset !== 'custom' && (
            <button type="button" className="bb-btn bb-btn-secondary" onClick={() => setPreset('custom')}>
              <Calendar size={14} />{t('reports.presetCustom')}
            </button>
          )}
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {state.status === 'loading' && (
        <>
          <div className="bb-kpi-grid">
            {[...Array(4)].map((_, i) => (
              <SkeletonBlock key={i} height={120} />
            ))}
          </div>
          <SkeletonBlock height={240} />
          <div style={{ height: 16 }} />
          <div className="bb-grid-2">
            <SkeletonBlock height={280} />
            <SkeletonBlock height={280} />
          </div>
        </>
      )}

      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('reports.loadError')}
          description={state.error}
          actionLabel={t('common.retry')}
          onAction={() => setRetryKey((k) => k + 1)}
        />
      )}

      {state.status === 'success' && state.data && (
        <>
          {/* KPI row */}
          <div className="bb-kpi-grid">
            {kpiCards.map((k) => {
              const trend = makeTrend(k.raw, k.prev, t)
              return (
                <div className="bb-kpi" key={k.key}>
                  <div className="bb-kpi-head">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {k.label}
                      <span
                        title={k.hint}
                        aria-label={k.hint}
                        role="img"
                        style={{ display: 'inline-flex', cursor: 'help', opacity: 0.65 }}
                      >
                        <Info size={13} aria-hidden="true" />
                      </span>
                    </span>
                    <span className={`bb-kpi-icon ${k.color || 'info'}`}>{k.icon}</span>
                  </div>
                  <div className={k.money ? 'bb-kpi-value bb-kpi-value--money' : 'bb-kpi-value'}>{k.value}</div>
                  <div className="bb-kpi-foot">
                    <TrendPill {...trend} />
                    {rangeLabel && <span className="bb-kpi-foot-label">{rangeLabel}</span>}
                  </div>
                </div>
              )
            })}
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
                        <stop offset="5%" stopColor="var(--admin-color-primary)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="var(--admin-color-primary)" stopOpacity={0} />
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
                      stroke="var(--admin-color-primary)"
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
                    <Bar dataKey="revenue" fill="var(--admin-color-primary)" radius={[0, 3, 3, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tables row */}
          <div className="bb-grid-2">
            <RankTable
              title={t('reports.chartTopProducts')}
              rows={state.data.topProducts}
              noDataLabel={t('reports.noData')}
              sortLabel={t('reports.sortBy', { defaultValue: 'Sắp xếp theo' })}
              cols={[
                { key: 'productName', label: t('reports.colProduct') },
                { key: 'unitsSold', label: t('reports.colUnitsSold'), right: true, sortable: true },
                { key: 'revenue', label: t('reports.colRevenue'), right: true, sortable: true, render: (r) => formatCurrencyVnd(r.revenue, locale) },
              ]}
            />
            <RankTable
              title={t('reports.chartTopCustomers')}
              rows={state.data.topCustomers}
              noDataLabel={t('reports.noData')}
              sortLabel={t('reports.sortBy', { defaultValue: 'Sắp xếp theo' })}
              cols={[
                { key: 'customerEmail', label: t('reports.colEmail') },
                { key: 'orderCount', label: t('reports.colOrders'), right: true, sortable: true },
                { key: 'revenue', label: t('reports.colSpend'), right: true, sortable: true, render: (r) => formatCurrencyVnd(r.revenue, locale) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  )
}
