import { useCallback, useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bot, MessageCircle, UserRoundCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminTable } from '../components/AdminTable'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { DetailSection } from '../components/DetailSection'
import { KpiCard } from '../components/KpiCard'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { ResponsiveFilterBar, Screen, ScreenHeader } from '../components/layout'
import { claimChatHandoff, fetchChatConversations, fetchChatHandoffs, fetchChatStats } from '../lib/adminApi'
import { useHasPermission } from '../lib/auth'
import { currentVietnamIsoDate, formatDateTime } from '../lib/formatters'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { useAdminList } from '../lib/useAdminList'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

function addDays(isoDate, offset) {
  const date = new Date(`${isoDate}T00:00:00+07:00`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function formatNumber(value, locale) {
  return value == null ? '—' : new Intl.NumberFormat(locale).format(value)
}

function formatWaiting(seconds, locale, t) {
  const value = Math.max(0, Number(seconds) || 0)
  if (value < 60) return t('chatAdmin.handoffs.waitingSeconds', { count: new Intl.NumberFormat(locale).format(value) })
  const minutes = Math.floor(value / 60)
  if (minutes < 60) return t('chatAdmin.handoffs.waitingMinutes', { count: new Intl.NumberFormat(locale).format(minutes) })
  return t('chatAdmin.handoffs.waitingHours', { count: new Intl.NumberFormat(locale).format(Math.floor(minutes / 60)) })
}

export function ChatConversationListScreen({ navigate }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'vi-VN'
  const queryClient = useQueryClient()
  const hasPermission = useHasPermission()
  const canReplyChat = hasPermission('chat.reply')
  const today = currentVietnamIsoDate()
  const defaultRange = useMemo(() => ({ from: addDays(today, -6), to: today }), [today])
  const initialQuery = useMemo(() => ({ ...defaultRange, page: 1, pageSize: 20 }), [defaultRange])
  const [query, setQuery] = useState(() => readQueryFromUrl(initialQuery))
  const [claimingId, setClaimingId] = useState('')
  const [claimError, setClaimError] = useState('')
  const range = useMemo(() => ({ from: query.from || defaultRange.from, to: query.to || defaultRange.to }), [defaultRange, query.from, query.to])

  const state = useAdminList(['chat-conversations', query, range], () => fetchChatConversations({ ...query, ...range }))
  const statsQuery = useQuery({ queryKey: ['chat-stats-today', today], queryFn: () => fetchChatStats({ date: today }), placeholderData: keepPreviousData })
  const periodStatsQuery = useQuery({ queryKey: ['chat-stats-period', range], queryFn: () => fetchChatStats(range), placeholderData: keepPreviousData })
  const handoffsQuery = useQuery({ queryKey: ['chat-handoffs'], queryFn: fetchChatHandoffs, refetchInterval: 30_000 })

  useEffect(() => syncQueryToUrl(query, initialQuery), [initialQuery, query])
  useEffect(() => subscribeAdminWs('/topic/admin/chat', () => {
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    queryClient.invalidateQueries({ queryKey: ['chat-stats-today'] })
    queryClient.invalidateQueries({ queryKey: ['chat-stats-period'] })
    queryClient.invalidateQueries({ queryKey: ['chat-handoffs'] })
  }), [queryClient])

  const updateQuery = useCallback((partial) => setQuery((current) => ({ ...current, ...partial, page: 1 })), [])
  const resetFilters = useCallback(() => setQuery((current) => ({ ...initialQuery, pageSize: current.pageSize })), [initialQuery])
  const isFiltered = query.from !== defaultRange.from || query.to !== defaultRange.to
  const handoffs = handoffsQuery.data?.items ?? []
  const stats = statsQuery.data
  const periodStats = periodStatsQuery.data

  async function claimHandoff(id) {
    if (!canReplyChat || claimingId) return
    setClaimingId(id)
    setClaimError('')
    try {
      await claimChatHandoff(id)
      await queryClient.invalidateQueries({ queryKey: ['chat-handoffs'] })
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    } catch (error) {
      setClaimError(error?.message || t('chatAdmin.handoffs.claimError'))
    } finally {
      setClaimingId('')
    }
  }

  const columns = useMemo(() => [
    { key: 'startedAt', label: t('chatAdmin.columns.startedAt'), render: (item) => <span className="whitespace-nowrap text-sm">{formatDateTime(item.startedAt)}</span> },
    { key: 'customer', label: t('chatAdmin.columns.customer'), render: (item) => <span className="font-semibold">{item.customerDisplayName || t('chatAdmin.guest')}</span> },
    { key: 'locale', label: t('chatAdmin.columns.language'), render: (item) => <span className="uppercase text-muted-foreground">{item.locale}</span> },
    { key: 'turnCount', label: t('chatAdmin.columns.turns'), align: 'right' },
    { key: 'handoffStatus', label: t('chatAdmin.columns.handoff'), render: (item) => item.handoffStatus ? <span className="bb-badge bb-badge-neutral">{t(`chatAdmin.handoffStatus.${item.handoffStatus}`, { defaultValue: t('common.unknown') })}</span> : '—' },
    { key: 'lastResultKind', label: t('chatAdmin.columns.result'), render: (item) => item.lastResultKind ? t(`chatAdmin.resultKind.${item.lastResultKind}`, { defaultValue: item.lastResultKind }) : '—' },
    { key: 'lastMessageAt', label: t('chatAdmin.columns.lastMessage'), render: (item) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(item.lastMessageAt)}</span> },
  ], [t])
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:chat')

  return (
    <Screen>
      <ScreenHeader group="sales" title={t('chatAdmin.title')} help={t('chatAdmin.description')} actions={<Button variant="secondary" onClick={() => navigate('/admin/settings?group=AI_ASSISTANT')}>{t('chatAdmin.openSettings')}</Button>} />

      {statsQuery.isError ? <StatePanel tone="danger" title={t('chatAdmin.statsLoadError')} description={statsQuery.error?.message} actionLabel={t('common.retry')} onAction={statsQuery.refetch} /> : null}

      <DetailSection className="mb-6" title={t('chatAdmin.quota.title')} description={t('chatAdmin.quota.description')} contentClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Bot size={16} />} label={t('chatAdmin.quota.used')} value={formatNumber(stats?.used, locale)} detail={stats ? t('chatAdmin.quota.usedDetail', { limit: formatNumber(stats.limit, locale) }) : ''} />
        <KpiCard icon={<Bot size={16} />} label={t('chatAdmin.quota.remaining')} value={formatNumber(stats?.remaining, locale)} />
        <KpiCard icon={<MessageCircle size={16} />} label={t('chatAdmin.today.conversations')} value={formatNumber(stats?.conversations, locale)} />
        <KpiCard icon={<MessageCircle size={16} />} label={t('chatAdmin.quota.periodConversations')} value={formatNumber(periodStats?.conversations, locale)} />
      </DetailSection>

      <DetailSection className="mb-6" title={t('chatAdmin.handoffs.title', { count: handoffsQuery.data?.waitingCount ?? 0 })} description={t('chatAdmin.handoffs.description')} badge={handoffsQuery.data?.waitingCount > 0 ? <span className="rounded-full bg-brand px-2 py-1 text-xs font-bold text-primary-foreground">{handoffsQuery.data.waitingCount}</span> : null}>
        {claimError ? <StatePanel tone="danger" title={t('chatAdmin.handoffs.claimError')} description={claimError} /> : null}
        {handoffsQuery.isError ? <StatePanel tone="danger" title={t('chatAdmin.handoffs.loadError')} actionLabel={t('common.retry')} onAction={handoffsQuery.refetch} /> : null}
        {handoffsQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {!handoffsQuery.isLoading && !handoffsQuery.isError && handoffs.length === 0 ? <StatePanel tone="neutral" title={t('chatAdmin.handoffs.empty')} description={t('chatAdmin.handoffs.emptyDescription')} /> : null}
        {handoffs.length > 0 ? <div className="grid gap-3">{handoffs.map((item) => <article key={item.id} className="grid gap-3 rounded-md border border-warning bg-warning-bg p-4 lg:grid-cols-[1fr_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-foreground">{item.customerKind === 'SIGNED_IN' ? t('chatAdmin.handoffs.signedIn') : t('chatAdmin.guest')}</strong><span className="text-sm font-semibold text-warning">{item.status === 'ACTIVE' ? t('chatAdmin.handoffs.activeWith', { name: item.assignedDisplayName || t('chatAdmin.handoffs.staffFallback') }) : t('chatAdmin.handoffs.waiting', { duration: formatWaiting(item.waitingSeconds, locale, t) })}</span></div><p className="mb-0 mt-2 text-sm text-foreground">{item.questionSummary || t('chatAdmin.handoffs.noQuestion')}</p>{item.products.length > 0 ? <p className="mb-0 mt-1 text-xs text-muted-foreground">{item.products.map((product) => product.name).join(', ')}</p> : null}</div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate(`/admin/chat/${item.conversationId}`)}>{t('chatAdmin.handoffs.openConversation')}</Button>{canReplyChat && item.status === 'WAITING' ? <Button disabled={claimingId === item.id} onClick={() => claimHandoff(item.id)}><UserRoundCheck size={16} aria-hidden="true" />{t('chatAdmin.handoffs.claim')}</Button> : null}</div></article>)}</div> : null}
      </DetailSection>

      <ResponsiveFilterBar ariaLabel={t('chatAdmin.filters.label')} activeFilterCount={Number(isFiltered)} onReset={resetFilters}>
        <label className="grid gap-1 text-sm text-muted-foreground">{t('chatAdmin.filters.from')}<Input type="date" value={query.from} onChange={(event) => updateQuery({ from: event.target.value })} className="h-9 w-auto" /></label>
        <label className="grid gap-1 text-sm text-muted-foreground">{t('chatAdmin.filters.to')}<Input type="date" value={query.to} onChange={(event) => updateQuery({ to: event.target.value })} className="h-9 w-auto" /></label>
        <PageSizeSelect value={query.pageSize} onChange={(pageSize) => updateQuery({ pageSize })} />
        <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
      </ResponsiveFilterBar>

      <DetailSection className="mb-6" title={t('chatAdmin.tableTitle')} description={t('chatAdmin.tableDescription')}>
        {state.status === 'error' ? <StatePanel tone="danger" title={t('chatAdmin.loadError')} description={state.error} actionLabel={t('common.retry')} onAction={state.refetch} /> : <><div data-testid="chat-conversations-table" className="w-full overflow-hidden"><AdminTable caption={t('chatAdmin.tableCaption')} columns={visibleColumns} rows={state.items || []} loading={state.status === 'loading'} pageSize={query.pageSize} rowHref={(item) => `/admin/chat/${item.id}`} onRowClick={(item) => navigate(`/admin/chat/${item.id}`)} densityKey="chat-conversations" mobileCard={(item) => ({ title: item.customerDisplayName || t('chatAdmin.guest'), subtitle: formatDateTime(item.startedAt), status: item.handoffStatus ? <span className="bb-badge bb-badge-neutral">{t(`chatAdmin.handoffStatus.${item.handoffStatus}`, { defaultValue: t('common.unknown') })}</span> : null, meta: [{ label: t('chatAdmin.columns.language'), value: String(item.locale || '—').toUpperCase() }, { label: t('chatAdmin.columns.turns'), value: item.turnCount ?? '—' }, { label: t('chatAdmin.columns.lastMessage'), value: formatDateTime(item.lastMessageAt) }], onClick: () => navigate(`/admin/chat/${item.id}`) })} /></div>{state.status === 'success' && (state.items || []).length === 0 ? <StatePanel tone="neutral" title={t('chatAdmin.empty')} description={isFiltered ? t('chatAdmin.emptyFiltered') : t('chatAdmin.emptyDescription')} /> : null}<PaginationControls pagination={state.pagination} disabled={state.isFetching} onPageChange={(page) => setQuery((current) => ({ ...current, page }))} /></>}
      </DetailSection>

      <DetailSection className="mb-6" title={t('chatAdmin.quality.title')} description={t('chatAdmin.quality.description')} contentClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<MessageCircle size={16} />} label={t('chatAdmin.quality.direct')} value={periodStats ? formatNumber((periodStats.quality?.answers ?? 0) + (periodStats.quality?.productResults ?? 0), locale) : '—'} />
        <KpiCard icon={<MessageCircle size={16} />} label={t('chatAdmin.quality.clarifications')} value={formatNumber(periodStats?.quality?.clarifications, locale)} />
        <KpiCard icon={<MessageCircle size={16} />} label={t('chatAdmin.quality.outOfScope')} value={formatNumber(periodStats?.quality?.outOfScope, locale)} />
        <KpiCard icon={<MessageCircle size={16} />} label={t('chatAdmin.quality.refusals')} value={formatNumber(periodStats?.quality?.contentRefusals, locale)} />
        {periodStatsQuery.isError ? <StatePanel tone="danger" title={t('chatAdmin.statsLoadError')} description={periodStatsQuery.error?.message} actionLabel={t('common.retry')} onAction={periodStatsQuery.refetch} /> : null}
      </DetailSection>
    </Screen>
  )
}
