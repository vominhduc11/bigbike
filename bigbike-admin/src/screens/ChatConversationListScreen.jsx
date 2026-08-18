import { useCallback, useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BadgeDollarSign, Bot, CircleAlert, Clock3, MessageCircle, PhoneCall, ReceiptText, ShieldAlert, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminTable } from '../components/AdminTable'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { FilterBar, Screen, ScreenHeader } from '../components/layout'
import { fetchChatConversations, fetchChatStats } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { useAdminList } from '../lib/useAdminList'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const INITIAL_QUERY = { from: '', to: '', hasLead: 'ALL', page: 1, pageSize: 20 }

function localDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatNumber(value) {
  return value == null ? '—' : new Intl.NumberFormat().format(value)
}

function formatUsd(value) {
  return value == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value)
}

function formatVnd(value) {
  return value == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
}

function formatLatency(value) {
  return value == null ? '—' : value >= 1_000 ? `${(value / 1_000).toFixed(1)} s` : `${Math.round(value)} ms`
}

function SummaryCard({ icon, label, value, detail }) {
  return (
    <article className="flex min-h-28 items-start gap-4 rounded-md border border-border bg-surface p-4">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-bold text-foreground">{value}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </article>
  )
}

export function ChatConversationListScreen({ navigate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const state = useAdminList(['chat-conversations', query], () => fetchChatConversations(query))
  const statsDate = query.to || localDate()
  const statsQuery = useQuery({
    queryKey: ['chat-stats', statsDate],
    queryFn: () => fetchChatStats(statsDate),
    placeholderData: keepPreviousData,
  })

  useEffect(() => syncQueryToUrl(query, INITIAL_QUERY), [query])

  useEffect(() => {
    const unsubscribe = subscribeAdminWs('/topic/admin/chat', () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['chat-stats'] })
    })
    return unsubscribe
  }, [queryClient])

  const updateQuery = useCallback((partial) => {
    setQuery((current) => ({ ...current, ...partial, page: 1 }))
  }, [])

  const resetFilters = useCallback(() => setQuery(INITIAL_QUERY), [])
  const items = state.items || []
  const stats = statsQuery.data
  const isFiltered = Boolean(query.from || query.to || query.hasLead !== 'ALL')

  const columns = useMemo(() => [
    {
      key: 'startedAt',
      label: t('chatAdmin.columns.startedAt'),
      render: (item) => <span className="whitespace-nowrap text-sm">{formatDateTime(item.startedAt)}</span>,
    },
    {
      key: 'customer',
      label: t('chatAdmin.columns.customer'),
      render: (item) => <span className="font-semibold">{item.customerDisplayName || t('chatAdmin.guest')}</span>,
    },
    {
      key: 'locale',
      label: t('chatAdmin.columns.language'),
      render: (item) => <span className="uppercase text-muted-foreground">{item.locale}</span>,
    },
    {
      key: 'turnCount',
      label: t('chatAdmin.columns.turns'),
      align: 'right',
    },
    {
      key: 'aiCallCount',
      label: t('chatAdmin.columns.aiCalls'),
      align: 'right',
    },
    {
      key: 'averageLatencyMs',
      label: t('chatAdmin.columns.latency'),
      render: (item) => <span className="whitespace-nowrap">{item.hasTelemetry ? formatLatency(item.averageLatencyMs) : '—'}</span>,
      align: 'right',
    },
    {
      key: 'estimatedCostUsd',
      label: t('chatAdmin.columns.cost'),
      render: (item) => <span className="whitespace-nowrap">{item.hasTelemetry ? formatUsd(item.estimatedCostUsd) : '—'}</span>,
      align: 'right',
    },
    {
      key: 'assistedRevenue',
      label: t('chatAdmin.columns.assistedRevenue'),
      render: (item) => <span className="whitespace-nowrap">{formatVnd(item.assistedRevenue)}</span>,
      align: 'right',
    },
    {
      key: 'hasLead',
      label: t('chatAdmin.columns.lead'),
      render: (item) => (
        <span className={item.hasLead ? 'text-success' : 'text-muted-foreground'}>
          {item.hasLead ? t('common.yes') : t('common.no')}
        </span>
      ),
    },
    {
      key: 'lastMessageAt',
      label: t('chatAdmin.columns.lastMessage'),
      render: (item) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(item.lastMessageAt)}</span>,
    },
  ], [t])

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('chatAdmin.eyebrow')}
        title={t('chatAdmin.title')}
        description={t('chatAdmin.description')}
        actions={<Button variant="secondary" onClick={() => navigate('/admin/settings')}>{t('chatAdmin.openSettings')}</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={<Sparkles size={20} />} label={t('chatAdmin.stats.aiCalls')} value={stats?.aiCalls ?? '—'} detail={stats ? t('chatAdmin.stats.limit', { count: stats.dailyLimit }) : ''} />
        <SummaryCard icon={<Bot size={20} />} label={t('chatAdmin.stats.remaining')} value={stats?.remainingAiCalls ?? '—'} />
        <SummaryCard icon={<MessageCircle size={20} />} label={t('chatAdmin.stats.conversations')} value={stats?.conversations ?? '—'} />
        <SummaryCard icon={<PhoneCall size={20} />} label={t('chatAdmin.stats.leads')} value={stats?.leads ?? '—'} />
        <SummaryCard icon={<CircleAlert size={20} />} label={t('chatAdmin.stats.unanswered')} value={stats?.unanswered ?? '—'} />
        <SummaryCard icon={<Clock3 size={20} />} label={t('chatAdmin.stats.averageLatency')} value={stats?.hasTelemetry ? formatLatency(stats.averageLatencyMs) : '—'} />
        <SummaryCard
          icon={<Bot size={20} />}
          label={t('chatAdmin.stats.tokens')}
          value={stats?.hasTelemetry ? formatNumber((stats.inputTokens ?? 0) + (stats.outputTokens ?? 0) + (stats.thinkingTokens ?? 0)) : '—'}
          detail={stats?.hasTelemetry ? t('chatAdmin.stats.providerRequests', { count: stats.providerRequests ?? 0 }) : t('chatAdmin.stats.noTelemetry')}
        />
        <SummaryCard icon={<BadgeDollarSign size={20} />} label={t('chatAdmin.stats.estimatedCost')} value={stats?.hasTelemetry ? formatUsd(stats.estimatedCostUsd) : '—'} detail={stats?.hasTelemetry ? t('chatAdmin.stats.estimateNotice') : t('chatAdmin.stats.noTelemetry')} />
        <SummaryCard icon={<ShieldAlert size={20} />} label={t('chatAdmin.stats.contentRefusals')} value={formatNumber(stats?.contentRefusals)} />
        <SummaryCard icon={<ReceiptText size={20} />} label={t('chatAdmin.stats.assistedOrders')} value={formatNumber(stats?.assistedOrders)} detail={stats ? formatVnd(stats.assistedRevenue) : ''} />
      </div>

      <FilterBar ariaLabel={t('chatAdmin.filters.label')}>
        <label className="grid gap-1 text-sm text-muted-foreground">
          {t('chatAdmin.filters.from')}
          <Input type="date" value={query.from} onChange={(event) => updateQuery({ from: event.target.value })} className="h-9 w-auto" />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          {t('chatAdmin.filters.to')}
          <Input type="date" value={query.to} onChange={(event) => updateQuery({ to: event.target.value })} className="h-9 w-auto" />
        </label>
        <FilterSelect
          value={query.hasLead}
          onValueChange={(value) => updateQuery({ hasLead: value })}
          ariaLabel={t('chatAdmin.filters.lead')}
          options={[
            { value: 'ALL', label: t('chatAdmin.filters.allLeads') },
            { value: 'true', label: t('chatAdmin.filters.hasLead') },
            { value: 'false', label: t('chatAdmin.filters.noLead') },
          ]}
        />
        <PageSizeSelect value={query.pageSize} onChange={(pageSize) => updateQuery({ pageSize })} />
        {isFiltered ? <Button type="button" variant="ghost" onClick={resetFilters}>{t('common.resetFilters')}</Button> : null}
      </FilterBar>

      {state.status === 'error' ? (
        <StatePanel tone="danger" title={t('chatAdmin.loadError')} description={state.error} actionLabel={t('common.retry')} onAction={state.refetch} />
      ) : null}

      {state.status !== 'error' ? (
        <>
          <AdminTable
            caption={t('chatAdmin.tableCaption')}
            columns={columns}
            rows={items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
            rowHref={(item) => `/admin/chat/${item.id}`}
            onRowClick={(item) => navigate(`/admin/chat/${item.id}`)}
            mobileCard={(item) => ({
              title: item.customerDisplayName || t('chatAdmin.guest'),
              subtitle: formatDateTime(item.startedAt),
              meta: [
                { label: t('chatAdmin.columns.turns'), value: item.turnCount },
                { label: t('chatAdmin.columns.aiCalls'), value: item.aiCallCount },
                { label: t('chatAdmin.columns.cost'), value: item.hasTelemetry ? formatUsd(item.estimatedCostUsd) : '—' },
                { label: t('chatAdmin.columns.assistedRevenue'), value: formatVnd(item.assistedRevenue) },
              ],
              onClick: () => navigate(`/admin/chat/${item.id}`),
            })}
          />
          {state.status === 'success' && items.length === 0 ? (
            <StatePanel tone="neutral" title={t('chatAdmin.empty')} description={isFiltered ? t('chatAdmin.emptyFiltered') : t('chatAdmin.emptyDescription')} />
          ) : null}
          <PaginationControls pagination={state.pagination} disabled={state.isFetching} onPageChange={(page) => setQuery((current) => ({ ...current, page }))} />
        </>
      ) : null}
    </Screen>
  )
}
