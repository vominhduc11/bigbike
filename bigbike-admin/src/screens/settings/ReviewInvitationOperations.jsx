import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Ban, CheckCircle2, Clock3, Mail, RefreshCw, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '@/components/AdminTable'
import { DetailSection } from '@/components/DetailSection'
import { KpiCard } from '@/components/KpiCard'
import { PaginationControls } from '@/components/PaginationControls'
import { StatePanel } from '@/components/StatePanel'
import { StatusBadge } from '@/components/StatusBadge'
import { FilterBar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  fetchReviewInvitationOptOuts,
  fetchReviewInvitations,
  fetchReviewInvitationSummary,
  skipReviewInvitationAsRefunded,
} from '@/lib/adminApi'
import { showConfirm } from '@/lib/confirm'
import { formatDateTime } from '@/lib/formatters'
import { toast } from '@/lib/toast'

const PAGE_SIZE = 20
const STATUS_OPTIONS = ['ALL', 'PENDING', 'SENDING', 'SENT', 'FAILED', 'UNCERTAIN', 'SKIPPED']

function emptyPagination() {
  return { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1, hasNext: false, hasPrevious: false }
}

function operationMessage(row, t) {
  if (row.failureCode) {
    return t(`settings.reviewInvitation.failure.${row.failureCode}`, {
      defaultValue: row.failureMessage || t('settings.reviewInvitation.sendFailed'),
    })
  }
  if (row.skipReason) {
    return t(`settings.reviewInvitation.skipReason.${row.skipReason}`, {
      defaultValue: t('settings.reviewInvitation.notSent'),
    })
  }
  if (row.status === 'SENT') return t('settings.reviewInvitation.acceptedAt', { date: formatDateTime(row.providerAcceptedAt) })
  return '—'
}

export function ReviewInvitationOperations({ canUpdate }) {
  const { t } = useTranslation()
  const [summary, setSummary] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [deliveryPagination, setDeliveryPagination] = useState(emptyPagination)
  const [optOuts, setOptOuts] = useState([])
  const [optOutPagination, setOptOutPagination] = useState(emptyPagination)
  const [status, setStatus] = useState('ALL')
  const [deliveryPage, setDeliveryPage] = useState(1)
  const [optOutPage, setOptOutPage] = useState(1)
  const [deliverySearchInput, setDeliverySearchInput] = useState('')
  const [deliverySearch, setDeliverySearch] = useState('')
  const [optOutSearchInput, setOptOutSearchInput] = useState('')
  const [optOutSearch, setOptOutSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState(null)

  const loadData = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [summaryResult, deliveryResult, optOutResult] = await Promise.all([
        fetchReviewInvitationSummary(),
        fetchReviewInvitations({
          page: deliveryPage,
          pageSize: PAGE_SIZE,
          status,
          search: deliverySearch,
        }),
        fetchReviewInvitationOptOuts({
          page: optOutPage,
          pageSize: PAGE_SIZE,
          search: optOutSearch,
        }),
      ])
      setSummary(summaryResult)
      setDeliveries(deliveryResult.items)
      setDeliveryPagination(deliveryResult.pagination)
      setOptOuts(optOutResult.items)
      setOptOutPagination(optOutResult.pagination)
    } catch {
      setError(t('settings.reviewInvitation.loadError'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [deliveryPage, deliverySearch, optOutPage, optOutSearch, status, t])

  useEffect(() => {
    // The request owns this panel's loading/error lifecycle and must restart when a filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  const handleSkip = useCallback(async (row) => {
    const confirmed = await showConfirm(
      t('settings.reviewInvitation.skipConfirm', { order: row.orderNumber }),
      t('settings.reviewInvitation.skipConfirmTitle'),
    )
    if (!confirmed) return
    setActingId(row.id)
    try {
      await skipReviewInvitationAsRefunded(row.id)
      toast.success(t('settings.reviewInvitation.skipSuccess'))
      await loadData({ refresh: true })
    } catch {
      toast.error(t('settings.reviewInvitation.skipError'))
    } finally {
      setActingId(null)
    }
  }, [loadData, t])

  const columns = useMemo(() => [
    {
      key: 'orderNumber',
      label: t('settings.reviewInvitation.columns.order'),
      render: (row) => (
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold text-foreground">{row.orderNumber || '—'}</div>
          <div className="max-w-56 truncate text-xs text-muted-foreground" title={row.recipientEmail || undefined}>
            {row.recipientEmail || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'dueAt',
      label: t('settings.reviewInvitation.columns.schedule'),
      render: (row) => (
        <div className="text-sm">
          <div>{formatDateTime(row.dueAt)}</div>
          <div className="text-xs text-muted-foreground">
            {t('settings.reviewInvitation.completedAt', { date: formatDateTime(row.completedAt) })}
          </div>
        </div>
      ),
    },
    {
      key: 'products',
      label: t('settings.reviewInvitation.columns.products'),
      render: (row) => t('settings.reviewInvitation.productProgress', {
        reviewed: row.reviewedProductCount ?? 0,
        total: row.productCount ?? 0,
      }),
    },
    {
      key: 'status',
      label: t('settings.reviewInvitation.columns.status'),
      render: (row) => <StatusBadge type="reviewInvitation" status={row.status} />,
    },
    {
      key: 'result',
      label: t('settings.reviewInvitation.columns.result'),
      cellClassName: 'max-w-72 whitespace-normal',
      render: (row) => operationMessage(row, t),
    },
    {
      key: 'actions',
      label: t('settings.reviewInvitation.columns.actions'),
      align: 'right',
      render: (row) => row.status === 'PENDING' && canUpdate ? (
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11 whitespace-nowrap"
          disabled={actingId === row.id}
          onClick={() => handleSkip(row)}
        >
          <Ban size={14} aria-hidden="true" />
          {actingId === row.id
            ? t('settings.reviewInvitation.skipping')
            : t('settings.reviewInvitation.skipRefunded')}
        </Button>
      ) : '—',
    },
  ], [actingId, canUpdate, handleSkip, t])

  const optOutColumns = useMemo(() => [
    {
      key: 'email',
      label: t('settings.reviewInvitation.optOutColumns.email'),
      render: (row) => <span className="break-all font-medium text-foreground">{row.email || '—'}</span>,
    },
    {
      key: 'optedOutAt',
      label: t('settings.reviewInvitation.optOutColumns.date'),
      render: (row) => formatDateTime(row.optedOutAt),
    },
    {
      key: 'source',
      label: t('settings.reviewInvitation.optOutColumns.source'),
      render: () => t('settings.reviewInvitation.optOutSourceEmail'),
    },
  ], [t])

  if (loading) {
    return (
      <DetailSection title={t('settings.reviewInvitation.operationsTitle')}>
        <StatePanel title={t('settings.reviewInvitation.loading')} description={t('settings.reviewInvitation.loadingDescription')} />
      </DetailSection>
    )
  }

  if (error) {
    return (
      <DetailSection title={t('settings.reviewInvitation.operationsTitle')}>
        <StatePanel tone="danger" title={t('settings.reviewInvitation.loadErrorTitle')} description={error} actionLabel={t('common.retry')} onAction={loadData} />
      </DetailSection>
    )
  }

  const issueCount = Number(summary?.failed || 0) + Number(summary?.uncertain || 0)

  return (
    <div className="mb-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('settings.reviewInvitation.summaryAria')}>
        <KpiCard label={t('settings.reviewInvitation.kpi.pending')} value={summary?.pending ?? 0} icon={<Clock3 size={18} />} tone="warning" detail={t('settings.reviewInvitation.kpi.pendingHint')} />
        <KpiCard label={t('settings.reviewInvitation.kpi.sent')} value={summary?.sent ?? 0} icon={<CheckCircle2 size={18} />} tone="success" detail={t('settings.reviewInvitation.kpi.sentHint')} />
        <KpiCard label={t('settings.reviewInvitation.kpi.issues')} value={issueCount} icon={<AlertTriangle size={18} />} tone={issueCount > 0 ? 'danger' : 'info'} detail={t('settings.reviewInvitation.kpi.issuesHint')} />
        <KpiCard label={t('settings.reviewInvitation.kpi.optedOut')} value={summary?.optedOut ?? 0} icon={<Ban size={18} />} tone="neutral" detail={t('settings.reviewInvitation.kpi.optedOutHint')} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-info-border bg-info-bg p-4 text-sm text-info">
        <span>
          {t('settings.reviewInvitation.dailyUsage', {
            used: summary?.attemptedToday ?? 0,
            limit: summary?.dailyLimit ?? 0,
          })}
        </span>
        <span>{t('settings.reviewInvitation.transactionalPriority')}</span>
      </div>

      <DetailSection
        headingLevel={3}
        title={t('settings.reviewInvitation.historyTitle')}
        description={t('settings.reviewInvitation.historyDescription')}
        action={(
          <Button variant="secondary" size="sm" className="min-h-11" disabled={refreshing} onClick={() => loadData({ refresh: true })}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} aria-hidden="true" />
            {refreshing ? t('settings.refreshing') : t('settings.refresh')}
          </Button>
        )}
        noPadding
      >
        <FilterBar className="m-4" ariaLabel={t('settings.reviewInvitation.filters')}>
          <form
            className="flex min-w-64 flex-1 items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setDeliveryPage(1)
              setDeliverySearch(deliverySearchInput.trim())
            }}
          >
            <label className="min-w-0 flex-1 text-sm font-medium text-foreground">
              {t('settings.reviewInvitation.searchLabel')}
              <Input
                className="mt-1"
                value={deliverySearchInput}
                onChange={(event) => setDeliverySearchInput(event.target.value)}
                placeholder={t('settings.reviewInvitation.searchPlaceholder')}
              />
            </label>
            <Button type="submit" variant="secondary" className="min-h-11">
              <Search size={14} aria-hidden="true" />
              {t('common.search')}
            </Button>
          </form>
          <label className="w-full text-sm font-medium text-foreground sm:w-52">
            {t('settings.reviewInvitation.statusLabel')}
            <Select value={status} onValueChange={(value) => { setStatus(value); setDeliveryPage(1) }}>
              <SelectTrigger className="mt-1 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`settings.reviewInvitation.status.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </FilterBar>

        {deliveries.length === 0 ? (
          <StatePanel className="m-4" title={t('settings.reviewInvitation.emptyHistory')} description={t('settings.reviewInvitation.emptyHistoryDescription')} />
        ) : (
          <>
            <AdminTable
              columns={columns}
              rows={deliveries}
              caption={t('settings.reviewInvitation.historyCaption')}
              densityKey="settings-review-invitations"
              mobileCard={(row) => ({
                title: row.orderNumber || '—',
                subtitle: row.recipientEmail || '—',
                status: <StatusBadge type="reviewInvitation" status={row.status} />,
                meta: [
                  { label: t('settings.reviewInvitation.columns.schedule'), value: formatDateTime(row.dueAt) },
                  { label: t('settings.reviewInvitation.columns.products'), value: t('settings.reviewInvitation.productProgress', { reviewed: row.reviewedProductCount ?? 0, total: row.productCount ?? 0 }) },
                  { label: t('settings.reviewInvitation.columns.result'), value: operationMessage(row, t) },
                ],
                actions: row.status === 'PENDING' && canUpdate ? (
                  <Button variant="secondary" size="sm" className="min-h-11" disabled={actingId === row.id} onClick={() => handleSkip(row)}>
                    <Ban size={14} aria-hidden="true" /> {t('settings.reviewInvitation.skipRefunded')}
                  </Button>
                ) : null,
              })}
            />
            <div className="px-4">
              <PaginationControls pagination={deliveryPagination} onPageChange={setDeliveryPage} disabled={refreshing} />
            </div>
          </>
        )}
      </DetailSection>

      <DetailSection
        headingLevel={3}
        title={t('settings.reviewInvitation.optOutTitle')}
        description={t('settings.reviewInvitation.optOutDescription')}
        badge={<span className="bb-badge bb-badge-neutral"><Mail size={12} aria-hidden="true" />{summary?.optedOut ?? 0}</span>}
        noPadding
      >
        <FilterBar className="m-4" ariaLabel={t('settings.reviewInvitation.optOutFilters')}>
          <form
            className="flex w-full items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setOptOutPage(1)
              setOptOutSearch(optOutSearchInput.trim())
            }}
          >
            <label className="min-w-0 flex-1 text-sm font-medium text-foreground">
              {t('settings.reviewInvitation.optOutSearchLabel')}
              <Input
                className="mt-1"
                type="email"
                value={optOutSearchInput}
                onChange={(event) => setOptOutSearchInput(event.target.value)}
                placeholder={t('settings.reviewInvitation.optOutSearchPlaceholder')}
              />
            </label>
            <Button type="submit" variant="secondary" className="min-h-11">
              <Search size={14} aria-hidden="true" />
              {t('common.search')}
            </Button>
          </form>
        </FilterBar>

        {optOuts.length === 0 ? (
          <StatePanel className="m-4" title={t('settings.reviewInvitation.emptyOptOuts')} description={t('settings.reviewInvitation.emptyOptOutsDescription')} />
        ) : (
          <>
            <AdminTable
              columns={optOutColumns}
              rows={optOuts.map((item) => ({ ...item, id: item.email }))}
              caption={t('settings.reviewInvitation.optOutCaption')}
              densityKey="settings-review-invitation-opt-outs"
              mobileCard={(row) => ({
                title: row.email || '—',
                subtitle: t('settings.reviewInvitation.optOutSourceEmail'),
                meta: [{ label: t('settings.reviewInvitation.optOutColumns.date'), value: formatDateTime(row.optedOutAt) }],
              })}
            />
            <div className="px-4">
              <PaginationControls pagination={optOutPagination} onPageChange={setOptOutPage} disabled={refreshing} />
            </div>
          </>
        )}
      </DetailSection>
    </div>
  )
}
