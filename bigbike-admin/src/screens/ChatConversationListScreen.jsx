import { useCallback, useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bot, MessageCircle } from 'lucide-react'
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
import { fetchChatConversations, fetchChatStats } from '../lib/adminApi'
import { currentVietnamIsoDate, formatDateTime } from '../lib/formatters'
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

export function ChatConversationListScreen({ navigate }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'vi-VN'
  const today = currentVietnamIsoDate()
  const defaultRange = useMemo(() => ({ from: addDays(today, -6), to: today }), [today])
  const initialQuery = useMemo(() => ({ ...defaultRange, page: 1, pageSize: 20 }), [defaultRange])
  const [query, setQuery] = useState(() => readQueryFromUrl(initialQuery))
  const range = useMemo(
    () => ({ from: query.from || defaultRange.from, to: query.to || defaultRange.to }),
    [defaultRange, query.from, query.to],
  )

  const state = useAdminList(['chat-conversations', query, range], () =>
    fetchChatConversations({ ...query, ...range }),
  )
  const statsQuery = useQuery({
    queryKey: ['chat-stats-today', today],
    queryFn: () => fetchChatStats({ date: today }),
    placeholderData: keepPreviousData,
  })
  const periodStatsQuery = useQuery({
    queryKey: ['chat-stats-period', range],
    queryFn: () => fetchChatStats(range),
    placeholderData: keepPreviousData,
  })

  useEffect(() => syncQueryToUrl(query, initialQuery), [initialQuery, query])

  const updateQuery = useCallback((partial) => {
    setQuery((current) => ({ ...current, ...partial, page: 1 }))
  }, [])
  const resetFilters = useCallback(
    () => setQuery((current) => ({ ...initialQuery, pageSize: current.pageSize })),
    [initialQuery],
  )
  const isFiltered = query.from !== defaultRange.from || query.to !== defaultRange.to
  const stats = statsQuery.data
  const periodStats = periodStatsQuery.data

  const columns = useMemo(
    () => [
      {
        key: 'startedAt',
        label: t('chatAdmin.columns.startedAt'),
        render: (item) => (
          <span className="whitespace-nowrap text-sm">{formatDateTime(item.startedAt)}</span>
        ),
      },
      {
        key: 'customer',
        label: t('chatAdmin.columns.customer'),
        render: (item) => (
          <span className="font-semibold">{item.customerDisplayName || t('chatAdmin.guest')}</span>
        ),
      },
      {
        key: 'locale',
        label: t('chatAdmin.columns.language'),
        render: (item) => (
          <span className="uppercase text-muted-foreground">{item.locale || '—'}</span>
        ),
      },
      { key: 'turnCount', label: t('chatAdmin.columns.turns'), align: 'right' },
      {
        key: 'lastResultKind',
        label: t('chatAdmin.columns.result'),
        render: (item) =>
          item.lastResultKind
            ? t(`chatAdmin.resultKind.${item.lastResultKind}`, {
                defaultValue: item.lastResultKind,
              })
            : '—',
      },
      {
        key: 'lastMessageAt',
        label: t('chatAdmin.columns.lastMessage'),
        render: (item) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatDateTime(item.lastMessageAt)}
          </span>
        ),
      },
    ],
    [t],
  )
  const {
    visibleColumns,
    hiddenKeys,
    toggle: toggleColumn,
    allColumns,
  } = useColumnVisibility(columns, 'columns:chat')

  return (
    <Screen>
      <ScreenHeader
        group="sales"
        title={t('chatAdmin.title')}
        help={t('chatAdmin.description')}
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate('/admin/settings?group=AI_ASSISTANT')}
          >
            {t('chatAdmin.openSettings')}
          </Button>
        }
      />

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
        title={t('chatAdmin.quota.title')}
        description={t('chatAdmin.quota.description')}
        contentClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          icon={<Bot size={16} />}
          label={t('chatAdmin.quota.used')}
          value={formatNumber(stats?.used, locale)}
          detail={
            stats
              ? t('chatAdmin.quota.usedDetail', { limit: formatNumber(stats.limit, locale) })
              : ''
          }
        />
        <KpiCard
          icon={<Bot size={16} />}
          label={t('chatAdmin.quota.remaining')}
          value={formatNumber(stats?.remaining, locale)}
        />
        <KpiCard
          icon={<MessageCircle size={16} />}
          label={t('chatAdmin.today.conversations')}
          value={formatNumber(stats?.conversations, locale)}
        />
        <KpiCard
          icon={<MessageCircle size={16} />}
          label={t('chatAdmin.quota.periodConversations')}
          value={formatNumber(periodStats?.conversations, locale)}
        />
      </DetailSection>

      <ResponsiveFilterBar
        ariaLabel={t('chatAdmin.filters.label')}
        activeFilterCount={Number(isFiltered)}
        onReset={resetFilters}
      >
        <label className="grid gap-1 text-sm text-muted-foreground">
          {t('chatAdmin.filters.from')}
          <Input
            type="date"
            value={query.from}
            onChange={(event) => updateQuery({ from: event.target.value })}
            className="h-9 w-auto"
          />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          {t('chatAdmin.filters.to')}
          <Input
            type="date"
            value={query.to}
            onChange={(event) => updateQuery({ to: event.target.value })}
            className="h-9 w-auto"
          />
        </label>
        <PageSizeSelect value={query.pageSize} onChange={(pageSize) => updateQuery({ pageSize })} />
        <ColumnVisibilityToggle
          allColumns={allColumns}
          hiddenKeys={hiddenKeys}
          onToggle={toggleColumn}
        />
      </ResponsiveFilterBar>

      <DetailSection
        className="mb-6"
        title={t('chatAdmin.tableTitle')}
        description={t('chatAdmin.tableDescription')}
      >
        {state.status === 'error' ? (
          <StatePanel
            tone="danger"
            title={t('chatAdmin.loadError')}
            description={state.error}
            actionLabel={t('common.retry')}
            onAction={state.refetch}
          />
        ) : (
          <>
            <div data-testid="chat-conversations-table" className="w-full overflow-hidden">
              <AdminTable
                caption={t('chatAdmin.tableCaption')}
                columns={visibleColumns}
                rows={state.items || []}
                loading={state.status === 'loading'}
                pageSize={query.pageSize}
                rowHref={(item) => `/admin/chat/${item.id}`}
                onRowClick={(item) => navigate(`/admin/chat/${item.id}`)}
                densityKey="chat-conversations"
                mobileCard={(item) => ({
                  title: item.customerDisplayName || t('chatAdmin.guest'),
                  subtitle: formatDateTime(item.startedAt),
                  meta: [
                    {
                      label: t('chatAdmin.columns.language'),
                      value: String(item.locale || '—').toUpperCase(),
                    },
                    { label: t('chatAdmin.columns.turns'), value: item.turnCount ?? '—' },
                    {
                      label: t('chatAdmin.columns.lastMessage'),
                      value: formatDateTime(item.lastMessageAt),
                    },
                  ],
                  onClick: () => navigate(`/admin/chat/${item.id}`),
                })}
              />
            </div>
            {state.status === 'success' && (state.items || []).length === 0 ? (
              <StatePanel
                tone="neutral"
                title={t('chatAdmin.empty')}
                description={
                  isFiltered ? t('chatAdmin.emptyFiltered') : t('chatAdmin.emptyDescription')
                }
              />
            ) : null}
            <PaginationControls
              pagination={state.pagination}
              disabled={state.isFetching}
              onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
            />
          </>
        )}
      </DetailSection>

      <DetailSection
        className="mb-6"
        title={t('chatAdmin.quality.title')}
        description={t('chatAdmin.quality.description')}
        contentClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          icon={<MessageCircle size={16} />}
          label={t('chatAdmin.quality.direct')}
          value={
            periodStats
              ? formatNumber(
                  (periodStats.quality?.answers ?? 0) + (periodStats.quality?.productResults ?? 0),
                  locale,
                )
              : '—'
          }
        />
        <KpiCard
          icon={<MessageCircle size={16} />}
          label={t('chatAdmin.quality.clarifications')}
          value={formatNumber(periodStats?.quality?.clarifications, locale)}
        />
        <KpiCard
          icon={<MessageCircle size={16} />}
          label={t('chatAdmin.quality.outOfScope')}
          value={formatNumber(periodStats?.quality?.outOfScope, locale)}
        />
        <KpiCard
          icon={<MessageCircle size={16} />}
          label={t('chatAdmin.quality.refusals')}
          value={formatNumber(periodStats?.quality?.contentRefusals, locale)}
        />
        {periodStatsQuery.isError ? (
          <StatePanel
            tone="danger"
            title={t('chatAdmin.statsLoadError')}
            description={periodStatsQuery.error?.message}
            actionLabel={t('common.retry')}
            onAction={periodStatsQuery.refetch}
          />
        ) : null}
      </DetailSection>
    </Screen>
  )
}
