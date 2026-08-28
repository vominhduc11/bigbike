import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { formatVndShort, fmtIsoDateShort } from '../../lib/formatters'

// recharts (~346KB) lives only in this module so DashboardScreen can lazy-load it:
// the dashboard shell (KPIs + tables) paints first, the charts stream in after.

function fmtAxisMillions(value, locale, millionUnit) {
  if (!value && value !== 0) return ''
  if (value === 0) return '0 ₫'
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 10_000_000 ? 0 : 1,
  }).format(value / 1_000_000)
  return `${formatted} ${millionUnit}`
}

function formatTooltipDate(isoDate, locale) {
  if (!isoDate || typeof isoDate !== 'string') return ''
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function RevenueTooltip({
  active,
  payload,
  label,
  locale,
  revenueLabel,
  ordersLabel,
  ordersUnit,
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload ?? {}
  return (
    <div className="bb-dash-tooltip">
      <div className="bb-dash-tooltip-date">{formatTooltipDate(label, locale)}</div>
      <div className="mt-2 grid gap-2">
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-4">
          <span className="bb-dash-tooltip-row">{revenueLabel}</span>
          <strong className="text-right text-foreground tabular-nums">
            {formatVndShort(point.revenue)}
          </strong>
        </div>
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-4">
          <span className="bb-dash-tooltip-row">{ordersLabel}</span>
          <strong className="text-right text-foreground tabular-nums">
            {(point.orders ?? 0).toLocaleString(locale)} {ordersUnit}
          </strong>
        </div>
      </div>
    </div>
  )
}

function PieTooltip({
  active,
  payload,
  locale,
  countLabel,
  shareLabel,
  orderUnit,
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const total = d.payload?.total || 1
  const pct = (d.value / total) * 100
  const formattedPct = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(pct)
  return (
    <div className="bb-dash-tooltip">
      <div className="bb-dash-tooltip-name">{d.name}</div>
      <div className="mt-2 grid gap-2">
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-4">
          <span className="bb-dash-tooltip-meta">{countLabel}</span>
          <strong className="text-right text-foreground tabular-nums">
            {d.value.toLocaleString(locale)} {orderUnit}
          </strong>
        </div>
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-4">
          <span className="bb-dash-tooltip-meta">{shareLabel}</span>
          <strong className="text-right text-foreground tabular-nums">{formattedPct}%</strong>
        </div>
      </div>
    </div>
  )
}

// Recharts' <ResponsiveContainer> measures its DOM node (ResizeObserver) as
// soon as it mounts. Mounting from inside a just-resolved React.lazy +
// Suspense boundary can leave that first measurement/commit racing the
// Suspense reveal — recharts/recharts#2736. Deferring the container's own
// mount by one browser frame guarantees it only ever mounts into an already
// laid-out, visible node.
function useMountedAfterLayout() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return mounted
}

export function RevenueAreaChart({ revenueData }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const maxRevenue = revenueData.reduce(
    (max, point) => Math.max(max, Number(point.revenue) || 0),
    0,
  )

  // Tóm tắt cho screen reader: tổng doanh thu trong kỳ + ngày cao nhất.
  // Biểu đồ recharts (SVG) không tự phát ra số liệu, tooltip lại chỉ hiện khi
  // rê chuột — nên cung cấp bản đọc-được không cần hover.
  const totalRevenue = revenueData.reduce((s, d) => s + (d.revenue || 0), 0)
  const peak = revenueData.reduce(
    (best, d) => (d.revenue > (best?.revenue ?? -1) ? d : best),
    null,
  )
  const summary = t('dashboard.revenueChart.a11ySummary', {
    total: formatVndShort(totalRevenue),
    peakDate: peak ? fmtIsoDateShort(peak.date) : '—',
    peakValue: peak ? formatVndShort(peak.revenue) : '—',
  })

  return (
    <figure role="group" aria-label={t('dashboard.revenueChart.a11yLabel')} className="m-0">
      <p className="sr-only">{summary}</p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={revenueData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--bb-primary)" stopOpacity={0.18} />
            <stop offset="95%" stopColor="var(--bb-primary)" stopOpacity={0.01} />
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
          domain={[0, maxRevenue === 0 ? 1_000_000 : 'auto']}
          tickFormatter={(value) => fmtAxisMillions(
            value,
            locale,
            t('dashboard.revenueChart.millionUnit'),
          )}
          width={62}
        />
        <Tooltip
          content={(
            <RevenueTooltip
              locale={locale}
              revenueLabel={t('dashboard.revenueChart.revenue')}
              ordersLabel={t('dashboard.revenueChart.orders')}
              ordersUnit={t('dashboard.revenueChart.ordersAxis')}
            />
          )}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name={t('dashboard.revenueChart.revenue')}
          stroke="var(--bb-primary)"
          strokeWidth={2}
          fill="url(#grad-revenue)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  )
}

export function OrderStatusPie({ pieDataWithTotal }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  // Bản đọc-được cho biểu đồ tròn: legend dạng chữ đã có ở DashboardScreen,
  // nên ở đây chỉ cần tên truy cập tổng quát cho vùng đồ hoạ.
  const label = t('dashboard.orderStatusChart.a11yLabel')
  const total = pieDataWithTotal[0]?.total ?? 0
  const mounted = useMountedAfterLayout()
  return (
    <div role="group" aria-label={label}>
      {mounted && (
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
          <text
            x="50%"
            y="45%"
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--bb-text)"
            fontFamily="var(--admin-font-display)"
            fontSize="24"
            fontWeight="600"
            aria-hidden="true"
          >
            {total.toLocaleString(locale)}
          </text>
          <text
            x="50%"
            y="58%"
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--bb-text-muted)"
            fontSize="11"
            aria-hidden="true"
          >
            {t('dashboard.orderStatusChart.total')}
          </text>
          <Tooltip
            content={(
              <PieTooltip
                locale={locale}
                countLabel={t('dashboard.orderStatusChart.count')}
                shareLabel={t('dashboard.orderStatusChart.share')}
                orderUnit={t('dashboard.orderStatusChart.orderUnit')}
              />
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}
