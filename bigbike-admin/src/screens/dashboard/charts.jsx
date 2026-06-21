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
import { formatVndShort } from '../../lib/formatters'

// recharts (~346KB) lives only in this module so DashboardScreen can lazy-load it:
// the dashboard shell (KPIs + tables) paints first, the charts stream in after.

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

export function RevenueAreaChart({ revenueData }) {
  const { t } = useTranslation()

  // Tóm tắt cho screen reader: tổng doanh thu trong kỳ + ngày cao nhất.
  // Biểu đồ recharts (SVG) không tự phát ra số liệu, tooltip lại chỉ hiện khi
  // rê chuột — nên cung cấp bản đọc-được không cần hover.
  const totalRevenue = revenueData.reduce((s, d) => s + (d.revenue || 0), 0)
  const peak = revenueData.reduce(
    (best, d) => (d.revenue > (best?.revenue ?? -1) ? d : best),
    null,
  )
  const summary = t('dashboard.revenueChart.a11ySummary', {
    defaultValue: 'Tổng doanh thu trong kỳ: {{total}}. Ngày cao nhất: {{peakDate}} với {{peakValue}}.',
    total: formatVndShort(totalRevenue),
    peakDate: peak ? fmtIsoDateShort(peak.date) : '—',
    peakValue: peak ? formatVndShort(peak.revenue) : '—',
  })

  return (
    <figure role="group" aria-label={t('dashboard.revenueChart.a11yLabel', { defaultValue: 'Biểu đồ doanh thu theo ngày' })} className="m-0">
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
          tickFormatter={fmtAxisMillions}
          width={40}
        />
        <Tooltip content={<RevenueTooltip ordersUnit={t('dashboard.revenueChart.ordersAxis')} />} />
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
  const { t } = useTranslation()
  // Bản đọc-được cho biểu đồ tròn: legend dạng chữ đã có ở DashboardScreen,
  // nên ở đây chỉ cần tên truy cập tổng quát cho vùng đồ hoạ.
  const label = t('dashboard.orderStatusChart.a11yLabel', { defaultValue: 'Biểu đồ cơ cấu đơn hàng theo trạng thái' })
  return (
    <div role="group" aria-label={label}>
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
    </div>
  )
}
