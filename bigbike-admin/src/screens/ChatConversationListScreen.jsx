import { useCallback, useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BadgeDollarSign, Bot, CircleAlert, Clock3, DatabaseZap, Eye, MessageCircle, PhoneCall, ReceiptText, ShieldAlert, ShoppingCart, Sparkles, UserRoundCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminTable } from '../components/AdminTable'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { DetailSection } from '../components/DetailSection'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { FilterBar, Screen, ScreenHeader } from '../components/layout'
import {
  claimChatHandoff,
  fetchChatConversations,
  fetchChatDataGaps,
  fetchChatFunnel,
  fetchChatHandoffs,
  fetchChatStats,
  fetchChatUnanswered,
  fetchChatFeedback,
  fetchChatFeedbackTemplatePrefill,
} from '../lib/adminApi'
import { useHasPermission } from '../lib/auth'
import { currentVietnamIsoDate, formatDateTime } from '../lib/formatters'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { useAdminList } from '../lib/useAdminList'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const INITIAL_QUERY = { from: '', to: '', hasLead: 'ALL', page: 1, pageSize: 20 }

function formatNumber(value, locale) {
  return value == null ? '—' : new Intl.NumberFormat(locale).format(value)
}

function formatUsd(value, locale) {
  return value == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value)
}

function formatVnd(value, locale) {
  return value == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
}

function formatLatency(value, locale) {
  return value == null
    ? '—'
    : value >= 1_000
      ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1_000)} s`
      : `${new Intl.NumberFormat(locale).format(Math.round(value))} ms`
}

function formatPercent(value, locale) {
  return value == null ? '—' : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value)
}

function formatIsoDate(value, locale) {
  if (!value) return '—'
  const parsed = new Date(`${value}T00:00:00+07:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(parsed)
}

function formatWaiting(_requestedAt, fallbackSeconds, locale) {
  // The queue refreshes every 30 seconds and the backend supplies this value.
  // Keeping the render deterministic also prevents unrelated re-renders from
  // changing the displayed duration without a fresh server result.
  const seconds = Math.max(0, Number(fallbackSeconds) || 0)
  if (seconds < 60) return new Intl.NumberFormat(locale).format(seconds) + ' s'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return new Intl.NumberFormat(locale).format(minutes) + ' min'
  const hours = Math.floor(minutes / 60)
  return new Intl.NumberFormat(locale).format(hours) + ' h'
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
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'vi-VN'
  const queryClient = useQueryClient()
  const hasPermission = useHasPermission()
  const canReplyChat = hasPermission('chat.reply')
  const canReadProducts = hasPermission('products.read')
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [acknowledgingId, setAcknowledgingId] = useState('')
  const [claimError, setClaimError] = useState('')
  const [prefillId, setPrefillId] = useState('')
  const [prefillError, setPrefillError] = useState('')
  const state = useAdminList(['chat-conversations', query], () => fetchChatConversations(query))
  const statsDate = query.to || currentVietnamIsoDate()
  const statsQuery = useQuery({
    queryKey: ['chat-stats', statsDate],
    queryFn: () => fetchChatStats(statsDate),
    placeholderData: keepPreviousData,
  })
  const funnelQuery = useQuery({
    queryKey: ['chat-funnel', query.from, query.to],
    queryFn: () => fetchChatFunnel(query),
    placeholderData: keepPreviousData,
  })
  const handoffsQuery = useQuery({
    queryKey: ['chat-handoffs'],
    queryFn: fetchChatHandoffs,
    refetchInterval: 30_000,
  })
  const unansweredQuery = useQuery({
    queryKey: ['chat-unanswered', query.from, query.to],
    queryFn: () => fetchChatUnanswered(query),
    placeholderData: keepPreviousData,
  })
  const dataGapsQuery = useQuery({
    queryKey: ['chat-data-gaps'],
    queryFn: fetchChatDataGaps,
    enabled: canReadProducts,
  })
  const feedbackQuery = useQuery({
    queryKey: ['chat-feedback', query.from, query.to],
    queryFn: () => fetchChatFeedback(query),
    placeholderData: keepPreviousData,
  })

  useEffect(() => syncQueryToUrl(query, INITIAL_QUERY), [query])

  useEffect(() => {
    const unsubscribe = subscribeAdminWs('/topic/admin/chat', () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['chat-stats'] })
      queryClient.invalidateQueries({ queryKey: ['chat-funnel'] })
      queryClient.invalidateQueries({ queryKey: ['chat-handoffs'] })
      queryClient.invalidateQueries({ queryKey: ['chat-unanswered'] })
      queryClient.invalidateQueries({ queryKey: ['chat-feedback'] })
    })
    return unsubscribe
  }, [queryClient])

  const updateQuery = useCallback((partial) => {
    setQuery((current) => ({ ...current, ...partial, page: 1 }))
  }, [])

  const resetFilters = useCallback(() => {
    setQuery((current) => ({ ...INITIAL_QUERY, pageSize: current.pageSize }))
  }, [])
  const items = state.items || []
  const stats = statsQuery.data
  const isFiltered = Boolean(query.from || query.to || query.hasLead !== 'ALL')
  const funnel = funnelQuery.data
  const handoffs = handoffsQuery.data?.items ?? []
  const unanswered = unansweredQuery.data?.items ?? []
  const dataGaps = dataGapsQuery.data

  async function acknowledgeHandoff(id) {
    if (!canReplyChat || acknowledgingId) return
    setAcknowledgingId(id)
    setClaimError('')
    try {
      await claimChatHandoff(id)
      await queryClient.invalidateQueries({ queryKey: ['chat-handoffs'] })
    } catch (error) {
      setClaimError(error?.message || t('chatAdmin.handoffs.claimError'))
      await queryClient.invalidateQueries({ queryKey: ['chat-handoffs'] })
    } finally {
      setAcknowledgingId('')
    }
  }

  async function createTemplateFromFeedback(id) {
    if (!id || prefillId) return
    setPrefillId(id)
    setPrefillError('')
    try {
      const prefill = await fetchChatFeedbackTemplatePrefill(id)
      window.sessionStorage.setItem('bigbike:assistant-template-prefill', JSON.stringify(prefill))
      navigate('/admin/settings?group=AI_ASSISTANT')
    } catch (error) {
      setPrefillError(error?.message || t('chatAdmin.feedback.prefillError'))
    } finally {
      setPrefillId('')
    }
  }

  const actionColumns = useMemo(() => [
    {
      key: 'actionType',
      label: t('chatAdmin.actions.action'),
      render: (item) => t(`chatAdmin.actions.types.${item.actionType}`, { defaultValue: item.actionType }),
    },
    { key: 'clicks', label: t('chatAdmin.actions.clicks'), align: 'right' },
    { key: 'cartLines', label: t('chatAdmin.actions.cartLines'), align: 'right' },
    { key: 'orders', label: t('chatAdmin.actions.orders'), align: 'right' },
    { key: 'revenue', label: t('chatAdmin.actions.revenue'), align: 'right', render: (item) => formatVnd(item.revenue, locale) },
    { key: 'conversionRate', label: t('chatAdmin.actions.conversion'), align: 'right', render: (item) => formatPercent(item.conversionRate, locale) },
  ], [locale, t])
  const unansweredColumns = useMemo(() => [
    {
      key: 'createdAt',
      label: t('chatAdmin.unanswered.columns.time'),
      render: (item) => <span className="whitespace-nowrap text-sm">{formatDateTime(item.createdAt)}</span>,
    },
    {
      key: 'customerQuestion',
      label: t('chatAdmin.unanswered.columns.question'),
      render: (item) => <span className="line-clamp-3 text-sm text-foreground">{item.customerQuestion || '—'}</span>,
    },
    {
      key: 'reason',
      label: t('chatAdmin.unanswered.columns.reason'),
      render: (item) => t(`chatAdmin.unanswered.reasons.${item.reason}`, { defaultValue: item.reason || '—' }),
    },
  ], [t])
  const dataGapColumns = useMemo(() => [
    {
      key: 'name',
      label: t('chatAdmin.dataGaps.columns.product'),
      render: (item) => <span className="font-semibold text-foreground">{item.name || item.slug}</span>,
    },
    {
      key: 'gaps',
      label: t('chatAdmin.dataGaps.columns.gaps'),
      render: (item) => <span className="text-sm">{item.gaps.map((gap) => t(`chatAdmin.dataGaps.types.${gap}`, { defaultValue: gap })).join(', ')}</span>,
    },
    {
      key: 'rawOptions',
      label: t('chatAdmin.dataGaps.columns.rawOptions'),
      render: (item) => <span className="font-mono text-xs text-muted-foreground">{item.rawOptions.join(', ') || '—'}</span>,
    },
  ], [t])
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
      render: (item) => <span className="whitespace-nowrap">{item.hasTelemetry ? formatLatency(item.averageLatencyMs, locale) : '—'}</span>,
      align: 'right',
    },
    {
      key: 'estimatedCostUsd',
      label: t('chatAdmin.columns.cost'),
      render: (item) => <span className="whitespace-nowrap">{item.hasTelemetry ? formatUsd(item.estimatedCostUsd, locale) : '—'}</span>,
      align: 'right',
    },
    {
      key: 'assistedRevenue',
      label: t('chatAdmin.columns.assistedRevenue'),
      render: (item) => <span className="whitespace-nowrap">{formatVnd(item.assistedRevenue, locale)}</span>,
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
  ], [locale, t])
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:chat')

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('chatAdmin.eyebrow')}
        title={t('chatAdmin.title')}
        description={t('chatAdmin.description')}
        actions={<Button variant="secondary" onClick={() => navigate('/admin/settings')}>{t('chatAdmin.openSettings')}</Button>}
      />

      {stats?.monthlyCostWarningExceeded && stats.monthlyCostWarningUsd > 0 ? (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-warning bg-warning-bg p-4 text-warning" role="alert">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="m-0 font-semibold">{t('chatAdmin.monthlyWarning.title')}</p>
            <p className="mb-0 mt-1 text-sm">{t('chatAdmin.monthlyWarning.description', {
              cost: formatUsd(stats.monthlyCostUsd, locale),
              threshold: formatUsd(stats.monthlyCostWarningUsd, locale),
            })}</p>
          </div>
        </div>
      ) : null}

      {statsQuery.isError ? (
        <StatePanel
          tone="danger"
          title={t('chatAdmin.statsLoadError')}
          description={statsQuery.error?.message}
          actionLabel={t('common.retry')}
          onAction={statsQuery.refetch}
        />
      ) : null}

      <DetailSection
        className="mb-6"
        title={t('chatAdmin.handoffs.title', { count: handoffsQuery.data?.waitingCount ?? 0 })}
        description={t('chatAdmin.handoffs.description')}
        badge={handoffsQuery.data?.waitingCount > 0
          ? <span className="rounded-full bg-brand px-2 py-1 text-xs font-bold text-primary-foreground">{handoffsQuery.data.waitingCount}</span>
          : null}
      >
        {claimError ? <StatePanel tone="danger" title={t('chatAdmin.handoffs.claimError')} description={claimError} /> : null}
        {handoffsQuery.isError ? (
          <StatePanel tone="danger" title={t('chatAdmin.handoffs.loadError')} actionLabel={t('common.retry')} onAction={handoffsQuery.refetch} />
        ) : handoffsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : handoffs.length === 0 ? (
          <StatePanel tone="neutral" title={t('chatAdmin.handoffs.empty')} description={t('chatAdmin.handoffs.emptyDescription')} />
        ) : (
          <div className="grid gap-3">
            {handoffs.map((item) => (
              <article key={item.id} className="grid gap-3 rounded-md border border-warning bg-warning-bg p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-foreground">{item.customerKind === 'SIGNED_IN' ? t('chatAdmin.handoffs.signedIn') : t('chatAdmin.guest')}</strong>
                    <span className="text-sm font-semibold text-warning">
                      {item.status === 'ACTIVE'
                        ? t('chatAdmin.handoffs.activeWith', { name: item.assignedDisplayName || t('chatAdmin.handoffs.staffFallback') })
                        : t('chatAdmin.handoffs.waiting', { duration: formatWaiting(item.requestedAt, item.waitingSeconds, locale) })}
                    </span>
                    <span className="text-sm text-muted-foreground">{item.contactPresent ? t('chatAdmin.handoffs.hasContact') : t('chatAdmin.handoffs.noContact')}</span>
                  </div>
                  <p className="mb-0 mt-2 text-sm text-foreground">{item.questionSummary || t('chatAdmin.handoffs.noQuestion')}</p>
                  {item.products.length > 0 ? <p className="mb-0 mt-1 text-xs text-muted-foreground">{item.products.map((product) => product.name).join(', ')}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => navigate(`/admin/chat/${item.conversationId}`)}>{t('chatAdmin.handoffs.openConversation')}</Button>
                  {canReplyChat && item.status === 'WAITING' ? (
                    <Button disabled={acknowledgingId === item.id} onClick={() => acknowledgeHandoff(item.id)}>
                      <UserRoundCheck size={16} aria-hidden="true" />
                      {t('chatAdmin.handoffs.claim')}
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection
        className="mb-6"
        title={t('chatAdmin.feedback.title')}
        description={t('chatAdmin.feedback.description')}
      >
        {prefillError ? <StatePanel tone="danger" title={t('chatAdmin.feedback.prefillError')} description={prefillError} /> : null}
        {feedbackQuery.isError ? (
          <StatePanel tone="danger" title={t('chatAdmin.feedback.loadError')} actionLabel={t('common.retry')} onAction={feedbackQuery.refetch} />
        ) : feedbackQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[12rem_12rem_1fr]">
              <SummaryCard icon={<UserRoundCheck size={20} />} label={t('chatAdmin.feedback.helpful')} value={formatNumber(feedbackQuery.data?.helpful, locale)} />
              <SummaryCard icon={<CircleAlert size={20} />} label={t('chatAdmin.feedback.unhelpful')} value={formatNumber(feedbackQuery.data?.unhelpful, locale)} />
              <div className="rounded-md border border-border bg-surface p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">{t('chatAdmin.feedback.topIssues')}</p>
                {feedbackQuery.data?.issues?.length ? (
                  <ul className="grid gap-2 text-sm">
                    {feedbackQuery.data.issues.slice(0, 5).map((item) => (
                      <li key={`${item.topicCode}-${item.reason}`} className="flex justify-between gap-3">
                        <span>{t(`chatAdmin.feedback.reasons.${item.reason}`, { defaultValue: item.reason })} · {item.topicCode}</span>
                        <strong>{formatNumber(item.total, locale)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">{t('chatAdmin.feedback.empty')}</p>}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface p-4">
              <h3 className="m-0 text-sm font-semibold text-foreground">{t('chatAdmin.feedback.weeklyTrend')}</h3>
              {feedbackQuery.data?.weeklyTrend?.length ? (
                <div className="mt-3 grid gap-2" role="table" aria-label={t('chatAdmin.feedback.weeklyTrend')}>
                  {feedbackQuery.data.weeklyTrend.slice(-8).map((item) => (
                    <div key={item.weekStart} role="row" className="grid grid-cols-[minmax(8rem,1fr)_auto_auto] items-center gap-4 border-b border-border py-2 text-sm last:border-b-0">
                      <span role="cell" className="font-semibold text-foreground">{formatIsoDate(item.weekStart, locale)}</span>
                      <span role="cell" className="text-success">{t('chatAdmin.feedback.weekHelpful', { count: formatNumber(item.helpful, locale) })}</span>
                      <span role="cell" className="text-warning">{t('chatAdmin.feedback.weekUnhelpful', { count: formatNumber(item.unhelpful, locale) })}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mb-0 mt-3 text-sm text-muted-foreground">{t('chatAdmin.feedback.empty')}</p>}
            </div>
            {feedbackQuery.data?.samples?.length ? (
              <div className="grid gap-3">
                <h3 className="m-0 text-sm font-semibold text-foreground">{t('chatAdmin.feedback.recent')}</h3>
                {feedbackQuery.data.samples.slice(0, 10).map((item) => (
                  <article key={item.feedbackId} className="grid gap-3 rounded-md border border-border bg-surface p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-semibold text-foreground">{item.question || t('chatAdmin.feedback.questionUnavailable')}</p>
                      <p className="mb-0 mt-1 line-clamp-2 text-sm text-muted-foreground">{item.answer || '—'}</p>
                      <p className="mb-0 mt-2 text-xs text-muted-foreground">
                        {t('chatAdmin.feedback.reportedCount', { count: formatNumber(item.total, locale) })} · {t(`chatAdmin.feedback.reasons.${item.reason}`, { defaultValue: item.reason })} · {item.topicCode} · {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    <Button type="button" variant="secondary" disabled={Boolean(prefillId)} onClick={() => createTemplateFromFeedback(item.feedbackId)}>
                      {prefillId === item.feedbackId ? t('chatAdmin.feedback.preparing') : t('chatAdmin.feedback.createTemplate')}
                    </Button>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </DetailSection>

      <DetailSection
        className="mb-6"
        title={t('chatAdmin.salesFunnel.title')}
        description={t('chatAdmin.salesFunnel.description')}
        contentClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <SummaryCard icon={<MessageCircle size={20} />} label={t('chatAdmin.salesFunnel.conversations')} value={funnel ? formatNumber(funnel.conversations, locale) : '—'} />
        <SummaryCard icon={<Eye size={20} />} label={t('chatAdmin.salesFunnel.productViews')} value={funnel ? formatNumber(funnel.productViews, locale) : '—'} detail={funnel ? formatPercent(funnel.conversationToViewRate, locale) : ''} />
        <SummaryCard icon={<ShoppingCart size={20} />} label={t('chatAdmin.salesFunnel.cartAdds')} value={funnel ? formatNumber(funnel.cartAdds, locale) : '—'} detail={funnel ? formatPercent(funnel.viewToCartRate, locale) : ''} />
        <SummaryCard icon={<ReceiptText size={20} />} label={t('chatAdmin.salesFunnel.orders')} value={funnel ? formatNumber(funnel.orders, locale) : '—'} detail={funnel ? formatPercent(funnel.cartToOrderRate, locale) : ''} />
        <SummaryCard icon={<BadgeDollarSign size={20} />} label={t('chatAdmin.salesFunnel.revenue')} value={funnel ? formatVnd(funnel.revenue, locale) : '—'} />
        {funnel && !funnel.complete ? <p className="sm:col-span-2 xl:col-span-5 text-sm text-warning">{t('chatAdmin.salesFunnel.incomplete', { time: formatDateTime(funnel.matureThrough) })}</p> : null}
        {funnelQuery.isError ? <StatePanel tone="danger" title={t('chatAdmin.salesFunnel.loadError')} actionLabel={t('common.retry')} onAction={funnelQuery.refetch} /> : null}
      </DetailSection>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={<Sparkles size={20} />} label={t('chatAdmin.stats.aiCalls')} value={stats?.aiCalls ?? '—'} detail={stats ? t('chatAdmin.stats.limit', { count: stats.dailyLimit }) : ''} />
        <SummaryCard icon={<Bot size={20} />} label={t('chatAdmin.stats.remaining')} value={stats?.remainingAiCalls ?? '—'} />
        <SummaryCard icon={<MessageCircle size={20} />} label={t('chatAdmin.stats.conversations')} value={stats?.conversations ?? '—'} />
        <SummaryCard icon={<PhoneCall size={20} />} label={t('chatAdmin.stats.leads')} value={stats?.leads ?? '—'} />
        <SummaryCard icon={<CircleAlert size={20} />} label={t('chatAdmin.stats.unanswered')} value={stats?.unanswered ?? '—'} />
        <SummaryCard icon={<Clock3 size={20} />} label={t('chatAdmin.stats.averageLatency')} value={stats?.hasTelemetry ? formatLatency(stats.averageLatencyMs, locale) : '—'} />
        <SummaryCard
          icon={<Bot size={20} />}
          label={t('chatAdmin.stats.tokens')}
          value={stats?.hasTelemetry ? formatNumber((stats.inputTokens ?? 0) + (stats.outputTokens ?? 0) + (stats.thinkingTokens ?? 0), locale) : '—'}
          detail={stats?.hasTelemetry ? t('chatAdmin.stats.providerRequests', { count: stats.providerRequests ?? 0 }) : t('chatAdmin.stats.noTelemetry')}
        />
        <SummaryCard icon={<BadgeDollarSign size={20} />} label={t('chatAdmin.stats.estimatedCost')} value={stats?.hasTelemetry ? formatUsd(stats.estimatedCostUsd, locale) : '—'} detail={stats?.hasTelemetry ? t('chatAdmin.stats.estimateNotice') : t('chatAdmin.stats.noTelemetry')} />
        <SummaryCard icon={<ShieldAlert size={20} />} label={t('chatAdmin.stats.contentRefusals')} value={formatNumber(stats?.contentRefusals, locale)} />
        <SummaryCard icon={<ReceiptText size={20} />} label={t('chatAdmin.stats.assistedOrders')} value={formatNumber(stats?.assistedOrders, locale)} detail={stats ? formatVnd(stats.assistedRevenue, locale) : ''} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DetailSection
          title={t('chatAdmin.costs.title')}
          description={t('chatAdmin.costs.description')}
          contentClassName="grid gap-3 sm:grid-cols-2"
        >
          <SummaryCard icon={<BadgeDollarSign size={20} />} label={t('chatAdmin.costs.today')} value={stats ? formatUsd(stats.costs?.todayUsd, locale) : '—'} />
          <SummaryCard icon={<BadgeDollarSign size={20} />} label={t('chatAdmin.costs.month')} value={stats ? formatUsd(stats.costs?.monthUsd, locale) : '—'} />
          <SummaryCard icon={<MessageCircle size={20} />} label={t('chatAdmin.costs.averageConversation')} value={stats ? formatUsd(stats.costs?.averagePerConversationUsd, locale) : '—'} />
          <SummaryCard
            icon={<Bot size={20} />}
            label={t('chatAdmin.costs.text')}
            value={stats ? formatUsd(stats.costs?.textMonthUsd, locale) : '—'}
            detail={stats ? t('chatAdmin.costs.todayDetail', { cost: formatUsd(stats.costs?.textTodayUsd, locale) }) : ''}
          />
          <SummaryCard
            icon={<Eye size={20} />}
            label={t('chatAdmin.costs.images')}
            value={stats ? formatUsd(stats.costs?.imageMonthUsd, locale) : '—'}
            detail={stats ? t('chatAdmin.costs.todayDetail', { cost: formatUsd(stats.costs?.imageTodayUsd, locale) }) : ''}
          />
          <SummaryCard
            icon={<DatabaseZap size={20} />}
            label={t('chatAdmin.costs.internal')}
            value={stats ? formatUsd((stats.costs?.indexMonthUsd ?? 0) + (stats.costs?.evaluationMonthUsd ?? 0), locale) : '—'}
            detail={stats ? t('chatAdmin.costs.internalDetail', {
              index: formatUsd(stats.costs?.indexMonthUsd, locale),
              evaluation: formatUsd(stats.costs?.evaluationMonthUsd, locale),
            }) : ''}
          />
        </DetailSection>

        <DetailSection
          title={t('chatAdmin.fallbacks.title')}
          description={t('chatAdmin.fallbacks.description')}
          contentClassName="grid gap-3 sm:grid-cols-2"
        >
          <SummaryCard icon={<ShieldAlert size={20} />} label={t('chatAdmin.fallbacks.today')} value={formatNumber(stats?.fallbacks?.today, locale)} />
          <SummaryCard icon={<ShieldAlert size={20} />} label={t('chatAdmin.fallbacks.month')} value={formatNumber(stats?.fallbacks?.month, locale)} />
          <SummaryCard icon={<Clock3 size={20} />} label={t('chatAdmin.fallbacks.rate')} value={stats ? formatPercent(stats.fallbacks?.rate, locale) : '—'} />
          <SummaryCard icon={<Bot size={20} />} label={t('chatAdmin.fallbacks.lastReason')} value={stats?.fallbacks?.lastReason || t('chatAdmin.fallbacks.none')} />
          <SummaryCard
            icon={<CircleAlert size={20} />}
            label={t('chatAdmin.fallbacks.giveUp14Days')}
            value={stats ? formatPercent(stats.fallbacks?.giveUpRate14Days, locale) : '—'}
            detail={stats ? t('chatAdmin.fallbacks.giveUpDetail', {
              giveUps: formatNumber(stats.fallbacks?.giveUpCount14Days, locale),
              replies: formatNumber(stats.fallbacks?.replyCount14Days, locale),
              baseline: formatPercent(stats.fallbacks?.baselineGiveUpRate, locale),
            }) : ''}
          />
          <SummaryCard
            icon={<Clock3 size={20} />}
            label={t('chatAdmin.fallbacks.speed14Days')}
            value={stats ? formatLatency(stats.fallbacks?.p95LatencyMs14Days, locale) : '—'}
            detail={stats ? t('chatAdmin.fallbacks.speedDetail', {
              p50: formatLatency(stats.fallbacks?.p50LatencyMs14Days, locale),
            }) : ''}
          />
          {(stats?.modelUsage?.length ?? 0) > 0 ? (
            <div className="rounded-md border border-border bg-surface p-4 sm:col-span-2">
              <p className="m-0 text-sm font-semibold text-foreground">{t('chatAdmin.fallbacks.modelUsage')}</p>
              <ul className="mb-0 mt-3 grid gap-2 text-sm">
                {stats.modelUsage.map((item) => (
                  <li key={item.modelId} className="flex flex-wrap justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
                    <span className="font-mono text-xs text-foreground">{item.modelId}</span>
                    <span className="text-muted-foreground">{t('chatAdmin.fallbacks.modelUsageLine', {
                      count: formatNumber(item.uses, locale), cost: formatUsd(item.costUsd, locale),
                    })}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DetailSection>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DetailSection
          title={t('chatAdmin.quality.title')}
          description={t('chatAdmin.quality.description')}
          contentClassName="grid gap-3 sm:grid-cols-2"
        >
          <SummaryCard
            icon={<MessageCircle size={20} />}
            label={t('chatAdmin.quality.direct')}
            value={stats ? formatNumber((stats.quality?.answers ?? 0) + (stats.quality?.productResults ?? 0), locale) : '—'}
            detail={stats ? t('chatAdmin.quality.productResults', { count: stats.quality?.productResults ?? 0 }) : ''}
          />
          <SummaryCard icon={<CircleAlert size={20} />} label={t('chatAdmin.quality.clarifications')} value={stats ? formatNumber(stats.quality?.clarifications, locale) : '—'} />
          <SummaryCard icon={<ShieldAlert size={20} />} label={t('chatAdmin.quality.outOfScope')} value={stats ? formatNumber(stats.quality?.outOfScope, locale) : '—'} />
          <SummaryCard icon={<ShieldAlert size={20} />} label={t('chatAdmin.quality.refusals')} value={stats ? formatNumber(stats.quality?.contentRefusals, locale) : '—'} />
        </DetailSection>

        <DetailSection
          title={t('chatAdmin.leadFunnel.title')}
          description={t('chatAdmin.leadFunnel.description')}
          contentClassName="grid gap-3 sm:grid-cols-2"
        >
          <SummaryCard icon={<PhoneCall size={20} />} label={t('chatAdmin.leadFunnel.callbackFormOpened')} value={stats ? formatNumber(stats.leadFunnel?.callbackFormOpened, locale) : '—'} />
          <SummaryCard icon={<PhoneCall size={20} />} label={t('chatAdmin.leadFunnel.sequence1')} value={stats ? formatNumber(stats.leadFunnel?.sequence1Viewed, locale) : '—'} />
          <SummaryCard icon={<PhoneCall size={20} />} label={t('chatAdmin.leadFunnel.sequence2')} value={stats ? formatNumber(stats.leadFunnel?.sequence2Viewed, locale) : '—'} />
          <SummaryCard icon={<PhoneCall size={20} />} label={t('chatAdmin.leadFunnel.accepted')} value={stats ? formatNumber(stats.leadFunnel?.accepted, locale) : '—'} />
          <SummaryCard icon={<CircleAlert size={20} />} label={t('chatAdmin.leadFunnel.declined')} value={stats ? formatNumber(stats.leadFunnel?.declined, locale) : '—'} />
        </DetailSection>
      </div>

      <DetailSection
        className="mt-6"
        title={t('chatAdmin.actions.title')}
        description={t('chatAdmin.actions.description')}
      >
        <AdminTable
          caption={t('chatAdmin.actions.caption')}
          columns={actionColumns}
          rows={(stats?.actionStats ?? []).map((item) => ({ ...item, id: item.actionType }))}
          loading={statsQuery.isLoading}
          pageSize={5}
          mobileCard={(item) => ({
            title: t(`chatAdmin.actions.types.${item.actionType}`, { defaultValue: item.actionType }),
            meta: [
              { label: t('chatAdmin.actions.clicks'), value: item.clicks },
              { label: t('chatAdmin.actions.cartLines'), value: item.cartLines },
              { label: t('chatAdmin.actions.orders'), value: item.orders },
              { label: t('chatAdmin.actions.revenue'), value: formatVnd(item.revenue, locale) },
              { label: t('chatAdmin.actions.conversion'), value: formatPercent(item.conversionRate, locale) },
            ],
          })}
        />
        {!statsQuery.isLoading && !statsQuery.isError && (stats?.actionStats?.length ?? 0) === 0 ? (
          <StatePanel tone="neutral" title={t('chatAdmin.actions.empty')} description={t('chatAdmin.actions.emptyDescription')} />
        ) : null}
      </DetailSection>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DetailSection
          title={t('chatAdmin.unanswered.title')}
          description={t('chatAdmin.unanswered.description')}
        >
          <AdminTable
            caption={t('chatAdmin.unanswered.caption')}
            columns={unansweredColumns}
            rows={unanswered.map((item) => ({ ...item, id: item.assistantMessageId }))}
            loading={unansweredQuery.isLoading}
            pageSize={10}
            rowHref={(item) => `/admin/chat/${item.conversationId}`}
            onRowClick={(item) => navigate(`/admin/chat/${item.conversationId}`)}
            mobileCard={(item) => ({
              title: item.customerQuestion || '—',
              subtitle: formatDateTime(item.createdAt),
              meta: [{ label: t('chatAdmin.unanswered.columns.reason'), value: t(`chatAdmin.unanswered.reasons.${item.reason}`, { defaultValue: item.reason || '—' }) }],
              onClick: () => navigate(`/admin/chat/${item.conversationId}`),
            })}
          />
          {unansweredQuery.isError ? <StatePanel tone="danger" title={t('chatAdmin.unanswered.loadError')} actionLabel={t('common.retry')} onAction={unansweredQuery.refetch} /> : null}
          {!unansweredQuery.isLoading && !unansweredQuery.isError && unanswered.length === 0 ? <StatePanel tone="neutral" title={t('chatAdmin.unanswered.empty')} /> : null}
        </DetailSection>

        <DetailSection
          title={t('chatAdmin.dataGaps.title')}
          description={t('chatAdmin.dataGaps.description')}
        >
          {!canReadProducts ? (
            <StatePanel tone="neutral" title={t('chatAdmin.dataGaps.permissionDenied')} />
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <SummaryCard icon={<DatabaseZap size={20} />} label={t('chatAdmin.dataGaps.missingSize')} value={dataGaps ? formatNumber(dataGaps.missingSizeGuides, locale) : '—'} />
                <SummaryCard icon={<DatabaseZap size={20} />} label={t('chatAdmin.dataGaps.missingSpecs')} value={dataGaps ? formatNumber(dataGaps.missingSpecifications, locale) : '—'} />
                <SummaryCard icon={<DatabaseZap size={20} />} label={t('chatAdmin.dataGaps.rawOptions')} value={dataGaps ? formatNumber(dataGaps.rawOptionProducts, locale) : '—'} />
                <SummaryCard icon={<DatabaseZap size={20} />} label={t('chatAdmin.dataGaps.noAccessories')} value={dataGaps ? formatNumber(dataGaps.missingAccessoryLinks, locale) : '—'} />
              </div>
              <AdminTable
                caption={t('chatAdmin.dataGaps.caption')}
                columns={dataGapColumns}
                rows={(dataGaps?.items ?? []).map((item) => ({ ...item, id: item.productId }))}
                loading={dataGapsQuery.isLoading}
                pageSize={10}
                rowHref={(item) => `/admin/products/${item.productId}`}
                onRowClick={(item) => navigate(`/admin/products/${item.productId}`)}
                mobileCard={(item) => ({
                  title: item.name || item.slug,
                  meta: [{ label: t('chatAdmin.dataGaps.columns.gaps'), value: item.gaps.map((gap) => t(`chatAdmin.dataGaps.types.${gap}`, { defaultValue: gap })).join(', ') }],
                  onClick: () => navigate(`/admin/products/${item.productId}`),
                })}
              />
              {dataGapsQuery.isError ? <StatePanel tone="danger" title={t('chatAdmin.dataGaps.loadError')} actionLabel={t('common.retry')} onAction={dataGapsQuery.refetch} /> : null}
            </>
          )}
        </DetailSection>
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
        <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
        {isFiltered ? <Button type="button" variant="ghost" onClick={resetFilters}>{t('common.resetFilters')}</Button> : null}
      </FilterBar>

      {state.status === 'error' ? (
        <StatePanel tone="danger" title={t('chatAdmin.loadError')} description={state.error} actionLabel={t('common.retry')} onAction={state.refetch} />
      ) : null}

      {state.status !== 'error' ? (
        <>
          <AdminTable
            caption={t('chatAdmin.tableCaption')}
            columns={visibleColumns}
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
                { label: t('chatAdmin.columns.cost'), value: item.hasTelemetry ? formatUsd(item.estimatedCostUsd, locale) : '—' },
                { label: t('chatAdmin.columns.assistedRevenue'), value: formatVnd(item.assistedRevenue, locale) },
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
