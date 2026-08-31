import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  CircleDollarSign,
  Wallet,
  ShoppingBag,
  Receipt,
  ArrowRight,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useUrlSyncedState } from '../lib/useUrlSyncedState'
import { useHasPermission } from '../lib/auth'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { AdminTable } from '../components/AdminTable'
import { ScreenSkeleton } from '../components/ScreenSkeleton'
import { DetailSection } from '../components/DetailSection'
import { KpiCard } from '../components/KpiCard'
import { Screen, ScreenHeader } from '../components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { ExportButton } from '../components/ExportButton'
import { fetchAnalytics, exportOrdersCsv, exportCustomersCsv } from '../lib/adminApi'
import { formatCurrencyVnd, fmtIsoDateShort } from '../lib/formatters'
import {
  REPORT_PRESETS,
  inclusiveDateSpan,
  isIsoCalendarDate,
  normalizeReportPreset,
  resolveReportRange,
  shiftRangeBack,
  todayInVietnam,
} from './reports/dateRange'

function RevenueTooltip({ active, payload, label, locale }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bb-dash-tooltip">
      <div className="bb-dash-tooltip-date">{fmtIsoDateShort(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="bb-dash-tooltip-row" style={{ color: p.color }}>
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
    direction === 'up' ? (
      <TrendingUp size={10} />
    ) : direction === 'down' ? (
      <TrendingDown size={10} />
    ) : (
      <Minus size={10} />
    )
  return (
    <span className={`bb-kpi-trend ${cls}`}>
      {icon}
      {label}
    </span>
  )
}

// Ranked table card — bb-* classes; sort client-side trên cột số (top-N ≤ 1000 dòng).
function RankTable({ title, rows, cols, noDataLabel }) {
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

  // Cột `#` (số thứ tự) bơm sẵn vào row vì AdminTable render chỉ nhận row (không index).
  const columns = [
    { key: '_idx', label: '#', render: (r) => r._idx },
    ...cols.map((c) => ({
      key: c.key,
      label: c.label,
      align: c.right ? 'right' : undefined,
      sortable: c.sortable,
      render: c.render,
    })),
  ]
  const indexedRows = sortedRows.map((r, i) => ({ ...r, id: r.id ?? i, _idx: i + 1 }))

  return (
    <DetailSection title={title} headingLevel={3} noPadding>
      {sortedRows.length === 0 ? (
        <StatePanel tone="neutral" title={noDataLabel} />
      ) : (
        <AdminTable
          columns={columns}
          rows={indexedRows}
          caption={title}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortKey(key)
            setSortDir(dir)
          }}
          mobileCard={(row) => {
            const first = cols[0]
            const valueOf = (column) =>
              column?.render ? column.render(row) : (row[column?.key] ?? '—')
            return {
              title: (
                <span className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">#{row._idx}</span>
                  <span>{valueOf(first)}</span>
                </span>
              ),
              meta: cols.slice(1).map((column) => ({
                label: column.label,
                value: valueOf(column),
                tone: column.right ? 'strong' : undefined,
              })),
            }
          }}
        />
      )}
    </DetailSection>
  )
}

// % thay đổi giữa kỳ hiện tại và kỳ trước → {direction, label} cho TrendPill.
function makeTrend(current, previous, t) {
  if (previous == null)
    return {
      direction: 'neutral',
      label: t('reports.trendNoData', { defaultValue: 'Chưa có kỳ trước' }),
    }
  if (previous === 0) {
    if (current === 0)
      return {
        direction: 'neutral',
        label: t('reports.trendNoChange', { defaultValue: 'Không đổi' }),
      }
    return { direction: 'up', label: t('reports.trendNew', { defaultValue: 'Mới' }) }
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.round(pct * 10) / 10
  if (rounded === 0)
    return {
      direction: 'neutral',
      label: t('reports.trendNoChange', { defaultValue: 'Không đổi' }),
    }
  const sign = rounded > 0 ? '+' : ''
  return {
    direction: rounded > 0 ? 'up' : 'down',
    label: `${sign}${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
  }
}

export function ReportsScreen() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const hasPermission = useHasPermission()
  const canExport = hasPermission('reports.export')

  const [query, setQuery] = useUrlSyncedState(
    { preset: '30d', from: '', to: '' },
    {
      deserialize: {
        preset: normalizeReportPreset,
        from: (value) => (isIsoCalendarDate(value) ? value : ''),
        to: (value) => (isIsoCalendarDate(value) ? value : ''),
      },
    },
  )

  const { preset, from: customFrom, to: customTo } = query

  const setPreset = (val) => {
    setQuery((prev) => ({
      preset: val,
      from: val === 'custom' ? prev.from : '',
      to: val === 'custom' ? prev.to : '',
    }))
  }

  const setCustomFrom = (val) => {
    setQuery((prev) => ({ ...prev, preset: 'custom', from: val }))
  }

  const setCustomTo = (val) => {
    setQuery((prev) => ({ ...prev, preset: 'custom', to: val }))
  }

  const resolvedDates = useCallback(() => {
    return resolveReportRange(preset, customFrom, customTo)
  }, [preset, customFrom, customTo])

  const { from, to } = resolvedDates()
  const prevRange = useMemo(() => shiftRangeBack(from, to), [from, to])

  const isEnabled = Boolean(from && to)
  const isRangeValid = !isEnabled || from <= to

  const dateSpanDays = useMemo(() => inclusiveDateSpan(from, to), [from, to])
  const isRangeWithinLimit = dateSpanDays == null || dateSpanDays <= 90

  const shouldFetch = isEnabled && isRangeValid && isRangeWithinLimit
  const rangeHasError = isEnabled && (!isRangeValid || !isRangeWithinLimit)

  const {
    data: currentResult,
    isLoading: isCurrentLoading,
    isError: isCurrentError,
    refetch: refetchCurrent,
  } = useQuery({
    queryKey: ['analytics', from, to],
    queryFn: () => fetchAnalytics(from, to),
    enabled: shouldFetch,
  })

  const { data: prevResult } = useQuery({
    queryKey: ['analytics', prevRange.from, prevRange.to],
    queryFn: () => fetchAnalytics(prevRange.from, prevRange.to).catch(() => null),
    enabled: shouldFetch && Boolean(prevRange.from && prevRange.to),
  })

  const state = useMemo(() => {
    if (preset === 'custom' && (!customFrom || !customTo)) {
      return { status: 'custom_pending', data: null, prev: null, warning: '' }
    }
    if (!isRangeValid) {
      return {
        status: 'error',
        data: null,
        prev: null,
        warning: '',
        error: t('reports.dateRangeError'),
      }
    }
    if (!isRangeWithinLimit) {
      return {
        status: 'error',
        data: null,
        prev: null,
        warning: '',
        error: t('reports.maxRangeError'),
      }
    }
    if (isCurrentLoading) {
      return { status: 'loading', data: null, prev: null, warning: '' }
    }
    if (isCurrentError) {
      return {
        status: 'error',
        data: null,
        prev: null,
        warning: '',
        error: t('reports.loadErrorDesc', {
          defaultValue: 'Không thể tải báo cáo lúc này. Vui lòng thử lại.',
        }),
      }
    }
    return {
      status: 'success',
      data: currentResult?.data || null,
      prev: prevResult?.data || null,
      warning: currentResult?.warning || '',
    }
  }, [
    preset,
    customFrom,
    customTo,
    isRangeValid,
    isRangeWithinLimit,
    isCurrentLoading,
    isCurrentError,
    currentResult,
    prevResult,
    t,
  ])

  const handleRetry = () => {
    if (preset === 'custom' && customFrom && customTo && customFrom > customTo) {
      setQuery((prev) => ({ ...prev, from: customTo, to: customFrom }))
    } else {
      refetchCurrent()
    }
  }
  const canRetryError = isCurrentError || (isEnabled && !isRangeValid)

  const { from: exportFrom, to: exportTo } = resolvedDates()
  const tickFmt = (v) => `${(v / 1000000).toFixed(0)}M`

  const rangeLabel =
    exportFrom && exportTo
      ? t('reports.rangeFromTo', {
          from: exportFrom,
          to: exportTo,
          defaultValue: 'Từ {{from}} đến {{to}}',
        })
      : ''

  const presetTabs = [
    ...REPORT_PRESETS.map((p) => ({
      key: p.value,
      label: t(`reports.${p.key}`, { defaultValue: t('common.unknown') }),
    })),
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
  const kpiCards = state.data
    ? [
        {
          key: 'gmv',
          label: t('reports.kpiGmv'),
          value: formatCurrencyVnd(state.data.summary.grossOrderValue, locale),
          raw: state.data.summary.grossOrderValue,
          prev: state.prev?.summary.grossOrderValue,
          color: 'danger',
          money: true,
          icon: <CircleDollarSign size={15} />,
          hint: t('reports.kpiGmvHint', {
            defaultValue: 'Tổng giá trị đơn trong kỳ, không tính đơn đã huỷ.',
          }),
        },
        {
          key: 'paid',
          label: t('reports.kpiPaidRevenue'),
          value: formatCurrencyVnd(state.data.summary.paidRevenue, locale),
          raw: state.data.summary.paidRevenue,
          prev: state.prev?.summary.paidRevenue,
          color: 'success',
          money: true,
          icon: <Wallet size={15} />,
          hint: t('reports.kpiPaidRevenueHint', {
            defaultValue:
              'Tổng giá trị các đơn đã hoàn tất trong kỳ; không phải số giao dịch thanh toán đã thu.',
          }),
        },
        {
          key: 'orders',
          label: t('reports.kpiOrderCount'),
          value: state.data.summary.orderCount.toLocaleString(locale),
          raw: state.data.summary.orderCount,
          prev: state.prev?.summary.orderCount,
          color: 'info',
          icon: <ShoppingBag size={15} />,
          hint: t('reports.kpiOrderCountHint', {
            defaultValue: 'Số đơn phát sinh trong kỳ, không tính đơn đã huỷ.',
          }),
        },
        {
          key: 'aov',
          label: t('reports.kpiAov'),
          value: formatCurrencyVnd(
            state.data.summary.orderCount > 0 ? state.data.summary.avgOrderValue || 0 : 0,
            locale,
          ),
          raw: state.data.summary.avgOrderValue,
          prev: state.prev?.summary.avgOrderValue,
          color: 'brand',
          money: true,
          icon: <Receipt size={15} />,
          hint: t('reports.kpiAovHint', {
            defaultValue: 'Doanh số chia số đơn hợp lệ; không tính đơn đã huỷ.',
          }),
        },
      ]
    : []

  return (
    <Screen>
      <ScreenHeader
        group="reports"
        title={t('reports.title')}
        actions={
          <>
            <div className="bb-seg" role="tablist" aria-label={t('reports.title')}>
              {presetTabs.map((tab) => (
                <Button
                  variant="unstyled"
                  key={tab.key}
                  role="tab"
                  aria-selected={preset === tab.key}
                  className={preset === tab.key ? 'active' : ''}
                  onClick={() => setPreset(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            {preset === 'custom' ? (
              <>
                <Input
                  type="date"
                  aria-label={t('reports.customFrom')}
                  aria-invalid={rangeHasError}
                  value={customFrom}
                  max={todayInVietnam()}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <ArrowRight
                  size={14}
                  className="bb-muted self-center shrink-0"
                  aria-hidden="true"
                />
                <Input
                  type="date"
                  aria-label={t('reports.customTo')}
                  aria-invalid={rangeHasError}
                  value={customTo}
                  max={todayInVietnam()}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </>
            ) : null}
            <div className="flex gap-2">
              <ExportButton
                disabled={!canExport || !shouldFetch}
                title={!canExport ? t('reports.requirePermission') : undefined}
                onExport={() =>
                  runExport(() =>
                    exportOrdersCsv({
                      from: exportFrom,
                      to: exportTo,
                      orderScope: 'ALL',
                    }),
                  )
                }
              >
                {t('reports.exportOrders')}
              </ExportButton>
              <ExportButton
                disabled={!canExport}
                title={!canExport ? t('reports.requirePermission') : t('reports.exportAllHint')}
                onExport={() => runExport(() => exportCustomersCsv())}
              >
                {t('reports.exportCustomers')}
              </ExportButton>
            </div>
          </>
        }
      />

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <Alert tone="info" size="sm" className="mb-4" role="status">
        {t('reports.historyScopeDisclosure')}
      </Alert>

      {state.status === 'loading' && (
        <>
          <div className="bb-kpi-grid bb-kpi-grid-4">
            {[...Array(4)].map((_, i) => (
              <ScreenSkeleton key={i} variant="cards" count={1} showHeader={false} />
            ))}
          </div>
          <ScreenSkeleton variant="cards" count={1} showHeader={false} />
          <div style={{ height: 16 }} />
          <div className="bb-grid-2">
            <ScreenSkeleton variant="cards" count={1} showHeader={false} />
            <ScreenSkeleton variant="cards" count={1} showHeader={false} />
          </div>
        </>
      )}

      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('reports.loadError')}
          description={state.error}
          actionLabel={canRetryError ? t('common.retry') : undefined}
          onAction={canRetryError ? handleRetry : undefined}
        />
      )}

      {state.status === 'custom_pending' && (
        <StatePanel
          tone="neutral"
          title={t('reports.customPendingTitle')}
          description={t('reports.customPendingDesc')}
        />
      )}

      {state.status === 'success' && state.data && (
        <>
          {/* KPI row */}
          <div className="bb-kpi-grid bb-kpi-grid-4">
            {kpiCards.map((k) => {
              const trend = makeTrend(k.raw, k.prev, t)
              return (
                <KpiCard
                  key={k.key}
                  label={k.label}
                  value={k.value}
                  icon={k.icon}
                  tone={k.color || 'info'}
                  money={k.money}
                  headerExtra={
                    <span
                      title={k.hint}
                      aria-label={k.hint}
                      role="img"
                      className="inline-flex cursor-help opacity-70"
                    >
                      <Info size={13} aria-hidden="true" />
                    </span>
                  }
                  footer={<TrendPill {...trend} />}
                  detail={rangeLabel}
                />
              )
            })}
          </div>

          {/* Revenue trend chart */}
          <DetailSection
            className="mb-4"
            title={t('reports.chartDailyRevenue')}
            description={t('dashboard.revenueChart.subtitle')}
            headingLevel={3}
          >
            {state.data.dailyRevenue?.length > 1 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart
                  data={state.data.dailyRevenue}
                  margin={{ left: 10, right: 10, top: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--admin-color-primary)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--admin-color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--admin-color-border-subtle)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--admin-color-text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    tickFormatter={fmtIsoDateShort}
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
            ) : (
              <div
                className="flex items-center justify-center bb-muted text-sm"
                style={{ minHeight: 240 }}
              >
                {t('reports.notEnoughDataForChart')}
              </div>
            )}
          </DetailSection>

          {/* Top products bar chart */}
          {state.data.topProducts?.length > 0 && (
            <DetailSection className="mb-4" title={t('reports.chartTopProducts')} headingLevel={3}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={state.data.topProducts.slice(0, 5)}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--admin-color-border-subtle)"
                    horizontal={false}
                  />
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
                    tickFormatter={(v) => (v.length > 20 ? `${v.slice(0, 20)}…` : v)}
                  />
                  <Tooltip
                    formatter={(v) => [formatCurrencyVnd(v, locale), t('reports.colRevenue')]}
                    cursor={{ fill: 'var(--admin-color-surface-hover)' }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="var(--admin-color-primary)"
                    radius={[0, 3, 3, 0]}
                    maxBarSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </DetailSection>
          )}

          {/* Tables row */}
          <div className="bb-grid-2">
            <RankTable
              title={t('reports.chartTopProducts')}
              rows={state.data.topProducts}
              noDataLabel={t('reports.noData')}
              cols={[
                { key: 'productName', label: t('reports.colProduct') },
                { key: 'unitsSold', label: t('reports.colUnitsSold'), right: true, sortable: true },
                {
                  key: 'revenue',
                  label: t('reports.colRevenue'),
                  right: true,
                  sortable: true,
                  render: (r) => formatCurrencyVnd(r.revenue, locale),
                },
              ]}
            />
            <RankTable
              title={t('reports.chartTopCustomers')}
              rows={state.data.topCustomers}
              noDataLabel={t('reports.noData')}
              cols={[
                { key: 'customerEmail', label: t('reports.colEmail') },
                { key: 'orderCount', label: t('reports.colOrders'), right: true, sortable: true },
                {
                  key: 'revenue',
                  label: t('reports.colSpend'),
                  right: true,
                  sortable: true,
                  render: (r) => formatCurrencyVnd(r.revenue, locale),
                },
              ]}
            />
          </div>
        </>
      )}
    </Screen>
  )
}
