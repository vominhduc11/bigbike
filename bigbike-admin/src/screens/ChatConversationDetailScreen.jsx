import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bot, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DetailSection } from '../components/DetailSection'
import { SectionCard } from '../components/SectionCard'
import { StatePanel } from '../components/StatePanel'
import { Screen, ScreenHeader } from '../components/layout'
import { fetchChatConversation } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'

function DetailValue({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children ?? '—'}</dd>
    </div>
  )
}

function sourceLabel(source, t) {
  const labels = {
    AI: t('chatAdmin.detail.sources.ai'),
    TEMPLATE: t('chatAdmin.detail.sources.template'),
    TOOL: t('chatAdmin.detail.sources.data'),
    CONTACT_FALLBACK: t('chatAdmin.detail.sources.staff'),
    OUT_OF_SCOPE: t('chatAdmin.detail.sources.outOfScope'),
    CONTENT_REFUSAL: t('chatAdmin.detail.sources.contentRefusal'),
    ROLE_DEFENSE: t('chatAdmin.detail.sources.roleDefense'),
  }
  return labels[source] || t('common.unknown')
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

function leadSourceLabel(source, t) {
  const labels = {
    ACCOUNT: t('chatAdmin.detail.contactSources.account'),
    FORM: t('chatAdmin.detail.contactSources.form'),
  }
  return labels[source] || t('common.unknown')
}

function endedReasonLabel(reason, t) {
  if (!reason) return t('chatAdmin.detail.active')
  const labels = {
    TURN_LIMIT: t('chatAdmin.detail.endStates.turnLimit'),
    OFF_TOPIC: t('chatAdmin.detail.endStates.offTopic'),
    HANDOFF: t('chatAdmin.detail.endStates.handoff'),
    AI_UNAVAILABLE: t('chatAdmin.detail.endStates.unavailable'),
    DAILY_LIMIT_REACHED: t('chatAdmin.detail.endStates.dailyLimit'),
    DISABLED: t('chatAdmin.detail.endStates.disabled'),
  }
  return labels[reason] || t('common.unknown')
}

export function ChatConversationDetailScreen({ conversationId, navigate }) {
  const { t } = useTranslation()
  const detailQuery = useQuery({
    queryKey: ['chat-conversation', conversationId],
    queryFn: () => fetchChatConversation(conversationId),
    enabled: Boolean(conversationId),
  })
  const conversation = detailQuery.data?.item

  if (detailQuery.isLoading) {
    return <Screen><StatePanel tone="info" title={t('chatAdmin.detail.loading')} description={t('chatAdmin.detail.loadingDescription')} /></Screen>
  }
  if (detailQuery.isError || !conversation) {
    return (
      <Screen>
        <StatePanel
          tone="danger"
          title={t('chatAdmin.detail.loadError')}
          description={t('chatAdmin.detail.notFound')}
          actionLabel={t('common.back')}
          onAction={() => navigate('/admin/chat')}
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('chatAdmin.eyebrow')}
        title={t('chatAdmin.detail.title')}
        description={t('chatAdmin.detail.description')}
        actions={<Button variant="secondary" onClick={() => navigate('/admin/chat')}><ArrowLeft size={16} aria-hidden="true" />{t('common.back')}</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DetailSection title={t('chatAdmin.detail.messages')} description={t('chatAdmin.detail.messagesDescription')}>
            {conversation.messages.length > 0 ? <ol className="grid gap-4">
              {conversation.messages.map((message) => {
                const isUser = message.role === 'USER'
                const Icon = isUser ? UserRound : Bot
                return (
                  <li key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser ? <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true"><Icon size={17} /></span> : null}
                    <article className={`max-w-2xl rounded-md border p-4 ${isUser ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface'}`}>
                      <header className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{isUser ? t('chatAdmin.detail.customer') : t('chatAdmin.detail.bigbike')}</span>
                        <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
                      </header>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.content || t('common.unknown')}</p>
                      {!isUser ? (
                        <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                          <p>{t('chatAdmin.detail.source')}: <span className="font-semibold text-foreground">{sourceLabel(message.source, t)}</span>{message.aiCalled ? ` · ${t('chatAdmin.detail.usedAi')}` : ''}</p>
                          {message.providerRequestCount != null ? (
                            <p className="mt-1">
                              {t('chatAdmin.detail.messageTelemetry', {
                                tokens: formatNumber((message.inputTokens ?? 0) + (message.outputTokens ?? 0) + (message.thinkingTokens ?? 0)),
                                requests: formatNumber(message.providerRequestCount),
                                latency: formatLatency(message.latencyMs),
                                cost: formatUsd(message.estimatedCostUsd),
                              })}
                            </p>
                          ) : <p className="mt-1">{t('chatAdmin.stats.noTelemetry')}</p>}
                        </div>
                      ) : null}
                    </article>
                    {isUser ? <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground" aria-hidden="true"><Icon size={17} /></span> : null}
                  </li>
                )
              })}
            </ol> : <StatePanel tone="neutral" title={t('chatAdmin.detail.noMessages')} description={t('chatAdmin.detail.noMessagesDescription')} />}
          </DetailSection>
        </div>

        <aside className="grid content-start gap-4">
          <SectionCard title={t('chatAdmin.detail.summary')} headingLevel={2}>
            <dl className="grid gap-4">
              <DetailValue label={t('chatAdmin.columns.language')}>{conversation.locale.toUpperCase()}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.turns')}>{conversation.turnCount}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.aiCalls')}>{conversation.aiCallCount}</DetailValue>
              <DetailValue label={t('chatAdmin.detail.tokens')}>{conversation.hasTelemetry ? formatNumber((conversation.inputTokens ?? 0) + (conversation.outputTokens ?? 0) + (conversation.thinkingTokens ?? 0)) : '—'}</DetailValue>
              <DetailValue label={t('chatAdmin.detail.providerRequests')}>{conversation.hasTelemetry ? formatNumber(conversation.providerRequests) : '—'}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.latency')}>{conversation.hasTelemetry ? formatLatency(conversation.averageLatencyMs) : '—'}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.cost')}>{conversation.hasTelemetry ? formatUsd(conversation.estimatedCostUsd) : '—'}</DetailValue>
              <DetailValue label={t('chatAdmin.stats.contentRefusals')}>{formatNumber(conversation.contentRefusals)}</DetailValue>
              <DetailValue label={t('chatAdmin.stats.assistedOrders')}>{formatNumber(conversation.assistedOrders)}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.assistedRevenue')}>{formatVnd(conversation.assistedRevenue)}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.startedAt')}>{formatDateTime(conversation.startedAt)}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.lastMessage')}>{formatDateTime(conversation.lastMessageAt)}</DetailValue>
              <DetailValue label={t('chatAdmin.detail.endedReason')}>{endedReasonLabel(conversation.endedReason, t)}</DetailValue>
            </dl>
          </SectionCard>

          <SectionCard title={t('chatAdmin.detail.assistedOrders')} headingLevel={2}>
            {conversation.orderAttributions.length > 0 ? (
              <ul className="grid gap-3">
                {conversation.orderAttributions.map((attribution) => (
                  <li key={attribution.orderLineItemId || `${attribution.orderId}-${attribution.createdAt}`} className="rounded-[var(--admin-radius-card)] border border-border bg-surface-muted p-3">
                    <Button type="button" variant="link" className="h-auto p-0 font-mono text-sm" onClick={() => navigate(`/admin/orders/${attribution.orderId}`)}>
                      {t('chatAdmin.detail.openOrder', { id: attribution.orderId.slice(0, 8) })}
                    </Button>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatVnd(attribution.attributedAmount)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(attribution.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">{t('chatAdmin.detail.noAssistedOrders')}</p>}
          </SectionCard>

          <SectionCard title={t('chatAdmin.detail.lead')} headingLevel={2}>
            {conversation.lead ? (
              <dl className="grid gap-4">
                <DetailValue label={t('chatAdmin.detail.leadName')}>{conversation.lead.name}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.phone')}>{conversation.lead.phone}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.note')}>{conversation.lead.note || t('chatAdmin.detail.none')}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.contactSource')}>{leadSourceLabel(conversation.lead.source, t)}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.consentedAt')}>{formatDateTime(conversation.lead.consentedAt)}</DetailValue>
              </dl>
            ) : <p className="text-sm text-muted-foreground">{t('chatAdmin.detail.noLead')}</p>}
          </SectionCard>
        </aside>
      </div>
    </Screen>
  )
}
