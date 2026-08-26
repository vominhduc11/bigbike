import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Activity, Bot, CircleAlert, Clock3, DatabaseZap, Gauge } from 'lucide-react'
import { DetailSection } from '../../components/DetailSection'
import { KpiCard } from '../../components/KpiCard'
import { StatePanel } from '../../components/StatePanel'
import { fetchChatStats } from '../../lib/adminApi'
import { useHasPermission } from '../../lib/auth'
import { currentVietnamIsoDate } from '../../lib/formatters'

function formatNumber(value, locale) {
  return value == null ? '—' : new Intl.NumberFormat(locale).format(value)
}

function formatUsd(value, locale) {
  return value == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value)
}

function formatLatency(value, locale) {
  if (value == null) return '—'
  return value >= 1000 ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1000)} s` : `${new Intl.NumberFormat(locale).format(Math.round(value))} ms`
}

export function AssistantOperationalStats() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'vi-VN'
  const canReadSettings = useHasPermission()('settings.read')
  const date = currentVietnamIsoDate()
  const query = useQuery({ queryKey: ['assistant-operational-stats', date], queryFn: () => fetchChatStats({ date }), enabled: canReadSettings })
  const stats = query.data
  const tokenTotal = stats?.hasTelemetry ? (stats.inputTokens ?? 0) + (stats.outputTokens ?? 0) + (stats.thinkingTokens ?? 0) : null

  if (!canReadSettings) return <DetailSection title={t('settings.assistantOperationalStats.title')}><StatePanel tone="neutral" title={t('settings.assistantOperationalStats.permissionDenied')} /></DetailSection>

  return (
    <DetailSection title={t('settings.assistantOperationalStats.title')} description={t('settings.assistantOperationalStats.description')}>
      {query.isError ? <StatePanel tone="danger" title={t('settings.assistantOperationalStats.loadError')} description={query.error?.message} actionLabel={t('common.retry')} onAction={query.refetch} /> : query.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : (
        <div className="grid gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={<Bot size={16} />} label={t('settings.assistantOperationalStats.tokensToday')} value={formatNumber(tokenTotal, locale)} />
            <KpiCard icon={<Activity size={16} />} label={t('settings.assistantOperationalStats.providerRequestsToday')} value={formatNumber(stats?.providerRequests, locale)} />
            <KpiCard icon={<Clock3 size={16} />} label={t('settings.assistantOperationalStats.averageLatencyToday')} value={formatLatency(stats?.averageLatencyMs, locale)} />
            <KpiCard icon={<Gauge size={16} />} label={t('settings.assistantOperationalStats.latency14Days')} value={formatLatency(stats?.fallbacks?.p95LatencyMs14Days, locale)} detail={t('settings.assistantOperationalStats.p50', { value: formatLatency(stats?.fallbacks?.p50LatencyMs14Days, locale) })} />
            <KpiCard icon={<CircleAlert size={16} />} label={t('settings.assistantOperationalStats.fallbacksThisMonth')} value={formatNumber(stats?.fallbacks?.month, locale)} detail={stats?.fallbacks?.lastReason || t('settings.assistantOperationalStats.noFallbackReason')} />
            <KpiCard icon={<DatabaseZap size={16} />} label={t('settings.assistantOperationalStats.indexCostThisMonth')} value={formatUsd(stats?.costs?.indexMonthUsd, locale)} money />
            <KpiCard icon={<DatabaseZap size={16} />} label={t('settings.assistantOperationalStats.evaluationCostThisMonth')} value={formatUsd(stats?.costs?.evaluationMonthUsd, locale)} money />
          </div>
          <div>
            <h3 className="mb-3 mt-0 text-sm font-semibold text-foreground">{t('settings.assistantOperationalStats.modelUsage')}</h3>
            {stats?.modelUsage?.length ? <ul className="m-0 grid gap-2 text-sm">{stats.modelUsage.map((item) => <li key={item.modelId} className="flex flex-wrap justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0"><span className="font-mono text-xs text-foreground">{item.modelId}</span><span className="text-muted-foreground">{t('settings.assistantOperationalStats.modelUsageLine', { count: formatNumber(item.uses, locale), cost: formatUsd(item.costUsd, locale) })}</span></li>)}</ul> : <StatePanel tone="neutral" title={t('settings.assistantOperationalStats.emptyModels')} />}
          </div>
        </div>
      )}
    </DetailSection>
  )
}
