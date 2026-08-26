import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bot, CircleCheckBig, Headset, Loader2, RotateCcw, Send, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DetailSection } from '../components/DetailSection'
import { StatePanel } from '../components/StatePanel'
import { Screen, ScreenHeader } from '../components/layout'
import {
  claimChatHandoff,
  closeChatHandoff,
  fetchAdminChatImageBlob,
  fetchChatConversation,
  fetchChatHandoffs,
  returnChatToAi,
  sendChatStaffMessage,
} from '../lib/adminApi'
import { useAuth, useHasPermission } from '../lib/auth'
import { subscribeAdminWs } from '../lib/adminWebSocket'
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

function PrivateCustomerImage({ image, alt, loadError }) {
  const [source, setSource] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    fetchAdminChatImageBlob(image.id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSource(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [image.id])

  if (failed) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-[var(--admin-radius-thumb)] border border-border bg-surface-muted p-4 text-center text-sm text-muted-foreground">
        {loadError}
      </div>
    )
  }
  if (!source) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-[var(--admin-radius-thumb)] border border-border bg-surface-muted" role="status">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
      </div>
    )
  }
  return (
    <img
      src={source}
      alt={alt}
      className="max-h-96 w-full rounded-[var(--admin-radius-thumb)] border border-border object-contain"
    />
  )
}

export function ChatConversationDetailScreen({ conversationId, navigate }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'vi-VN'
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const hasPermission = useHasPermission()
  const canReply = hasPermission('chat.reply')
  const [draft, setDraft] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [actionError, setActionError] = useState('')
  const detailQuery = useQuery({
    queryKey: ['chat-conversation', conversationId],
    queryFn: () => fetchChatConversation(conversationId),
    enabled: Boolean(conversationId),
  })
  const handoffsQuery = useQuery({
    queryKey: ['chat-handoffs'],
    queryFn: fetchChatHandoffs,
    enabled: Boolean(conversationId),
    refetchInterval: 30_000,
  })
  const conversation = detailQuery.data?.item
  const handoff = handoffsQuery.data?.items?.find((item) => item.conversationId === conversationId)
  const currentAdminId = String(user?.id || '')
  const isAssignedToMe = Boolean(handoff?.assignedAdminId && currentAdminId
    && handoff.assignedAdminId === currentAdminId)
  const assignedToAnother = handoff?.status === 'ACTIVE' && !isAssignedToMe
  const messages = useMemo(
    () => [...(conversation?.messages ?? [])].sort((left, right) => (
      (left.sequenceNo || 0) - (right.sequenceNo || 0)
    )),
    [conversation?.messages],
  )

  useEffect(() => {
    const unsubscribe = subscribeAdminWs('/topic/admin/chat', () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversation', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['chat-handoffs'] })
    })
    return unsubscribe
  }, [conversationId, queryClient])

  async function runAction(name, action) {
    if (busyAction) return
    setBusyAction(name)
    setActionError('')
    try {
      await action()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['chat-conversation', conversationId] }),
        queryClient.invalidateQueries({ queryKey: ['chat-handoffs'] }),
      ])
    } catch (error) {
      setActionError(error?.message || t('chatAdmin.detail.live.actionError'))
    } finally {
      setBusyAction('')
    }
  }

  function claim() {
    if (!handoff?.id || !canReply) return
    runAction('claim', () => claimChatHandoff(handoff.id))
  }

  function sendMessage() {
    const content = draft.trim()
    if (!content || !isAssignedToMe) return
    runAction('send', async () => {
      await sendChatStaffMessage(conversationId, content)
      setDraft('')
    })
  }

  function handBack() {
    if (!handoff?.id || !isAssignedToMe) return
    runAction('return', () => returnChatToAi(handoff.id, i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'vi'))
  }

  function closeConversation() {
    if (!handoff?.id || !isAssignedToMe) return
    runAction('close', () => closeChatHandoff(handoff.id, i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'vi'))
  }

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

      {handoffsQuery.isError ? (
        <StatePanel
          tone="danger"
          title={t('chatAdmin.detail.live.loadError')}
          actionLabel={t('common.retry')}
          onAction={handoffsQuery.refetch}
        />
      ) : null}

      {handoff ? (
        <section className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                <Headset size={18} />
              </span>
              <div>
                <p className="m-0 font-semibold text-foreground">
                  {handoff.status === 'WAITING'
                    ? t('chatAdmin.detail.live.waiting')
                    : t('chatAdmin.detail.live.active', { name: handoff.assignedDisplayName || t('chatAdmin.handoffs.staffFallback') })}
                </p>
                <p className="mb-0 mt-1 text-sm text-muted-foreground">
                  {handoff.status === 'WAITING'
                    ? t('chatAdmin.detail.live.waitingDescription')
                    : assignedToAnother
                      ? t('chatAdmin.detail.live.assignedToAnother')
                      : t('chatAdmin.detail.live.assignedToYou')}
                </p>
              </div>
            </div>
            {canReply && handoff.status === 'WAITING' ? (
              <Button type="button" disabled={Boolean(busyAction)} onClick={claim}>
                <Headset size={16} aria-hidden="true" />
                {busyAction === 'claim' ? t('chatAdmin.detail.live.claiming') : t('chatAdmin.handoffs.claim')}
              </Button>
            ) : null}
          </div>
          {actionError ? <p role="alert" className="mb-0 mt-3 text-sm font-semibold text-danger">{actionError}</p> : null}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DetailSection title={t('chatAdmin.detail.messages')} description={t('chatAdmin.detail.messagesDescription')}>
            {messages.length > 0 ? <ol className="grid gap-4">
              {messages.map((message) => {
                const isUser = message.role === 'USER'
                const isStaff = message.role === 'STAFF'
                const isSystem = message.role === 'SYSTEM'
                const Icon = isUser || isStaff ? UserRound : Bot
                if (isSystem) {
                  return (
                    <li key={message.id} className="flex justify-center">
                      <p className="m-0 max-w-2xl rounded-full border border-border bg-surface-muted px-4 py-2 text-center text-xs text-muted-foreground">
                        {message.content || t('common.unknown')} · {formatDateTime(message.createdAt)}
                      </p>
                    </li>
                  )
                }
                return (
                  <li key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser ? <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${isStaff ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`} aria-hidden="true"><Icon size={17} /></span> : null}
                    <article className={`max-w-2xl rounded-md border p-4 ${isUser ? 'border-primary/30 bg-primary/5' : isStaff ? 'border-secondary/40 bg-secondary/10' : 'border-border bg-surface'}`}>
                      <header className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {isUser
                            ? t('chatAdmin.detail.customer')
                            : isStaff
                              ? t('chatAdmin.detail.live.staffLabel', { name: message.staffDisplayName || t('chatAdmin.handoffs.staffFallback') })
                              : t('chatAdmin.detail.bigbike')}
                        </span>
                        <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
                      </header>
                      {message.images?.length ? (
                        <div className="mb-3 grid gap-2" data-admin-chat-images>
                          {message.images.map((image) => (
                            <PrivateCustomerImage
                              key={image.id}
                              image={image}
                              alt={t('chatAdmin.detail.customerImageAlt')}
                              loadError={t('chatAdmin.detail.customerImageLoadError')}
                            />
                          ))}
                        </div>
                      ) : null}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.content || t('common.unknown')}</p>
                      {!isUser && !isStaff ? (
                        <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                          <p>{t('chatAdmin.detail.source')}: <span className="font-semibold text-foreground">{sourceLabel(message.source, t)}</span>{message.aiCalled ? ` · ${t('chatAdmin.detail.usedAi')}` : ''}</p>
                          {message.providerRequestCount != null ? (
                            <p className="mt-1">
                              {t('chatAdmin.detail.messageTelemetry', {
                                tokens: formatNumber((message.inputTokens ?? 0) + (message.outputTokens ?? 0) + (message.thinkingTokens ?? 0), locale),
                                requests: formatNumber(message.providerRequestCount, locale),
                                latency: formatLatency(message.latencyMs, locale),
                                cost: formatUsd(message.estimatedCostUsd, locale),
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

            {handoff?.status === 'ACTIVE' ? (
              <div className="mt-5 border-t border-border pt-5">
                {isAssignedToMe ? (
                  <div className="grid gap-3">
                    <label className="grid gap-2 text-sm font-semibold text-foreground">
                      {t('chatAdmin.detail.live.replyLabel')}
                      <Textarea
                        className="min-h-28"
                        value={draft}
                        maxLength={2000}
                        disabled={Boolean(busyAction)}
                        placeholder={t('chatAdmin.detail.live.replyPlaceholder')}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') sendMessage()
                        }}
                      />
                    </label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="secondary" disabled={Boolean(busyAction)} onClick={handBack}>
                        <RotateCcw size={16} aria-hidden="true" /> {t('chatAdmin.detail.live.returnToAi')}
                      </Button>
                      <Button type="button" variant="outline" disabled={Boolean(busyAction)} onClick={closeConversation}>
                        <CircleCheckBig size={16} aria-hidden="true" /> {t('chatAdmin.detail.live.close')}
                      </Button>
                      <Button type="button" disabled={!draft.trim() || Boolean(busyAction)} onClick={sendMessage}>
                        <Send size={16} aria-hidden="true" />
                        {busyAction === 'send' ? t('chatAdmin.detail.live.sending') : t('chatAdmin.detail.live.send')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <StatePanel
                    tone="neutral"
                    title={t('chatAdmin.detail.live.composerLocked')}
                    description={t('chatAdmin.detail.live.composerLockedDescription', {
                      name: handoff.assignedDisplayName || t('chatAdmin.handoffs.staffFallback'),
                    })}
                  />
                )}
              </div>
            ) : null}
          </DetailSection>
        </div>

        <aside className="grid content-start gap-4">
      <DetailSection title={t('chatAdmin.detail.summary')} headingLevel={2}>
            <dl className="grid gap-4">
              <DetailValue label={t('chatAdmin.columns.language')}>{conversation.locale.toUpperCase()}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.turns')}>{conversation.turnCount}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.aiCalls')}>{conversation.aiCallCount}</DetailValue>
              <DetailValue label={t('chatAdmin.detail.tokens')}>{conversation.hasTelemetry ? formatNumber((conversation.inputTokens ?? 0) + (conversation.outputTokens ?? 0) + (conversation.thinkingTokens ?? 0), locale) : '—'}</DetailValue>
              <DetailValue label={t('chatAdmin.detail.providerRequests')}>{conversation.hasTelemetry ? formatNumber(conversation.providerRequests, locale) : '—'}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.latency')}>{conversation.hasTelemetry ? formatLatency(conversation.averageLatencyMs, locale) : '—'}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.cost')}>{conversation.hasTelemetry ? formatUsd(conversation.estimatedCostUsd, locale) : '—'}</DetailValue>
              <DetailValue label={t('chatAdmin.stats.contentRefusals')}>{formatNumber(conversation.contentRefusals, locale)}</DetailValue>
              <DetailValue label={t('chatAdmin.stats.assistedOrders')}>{formatNumber(conversation.assistedOrders, locale)}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.assistedRevenue')}>{formatVnd(conversation.assistedRevenue, locale)}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.startedAt')}>{formatDateTime(conversation.startedAt)}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.lastMessage')}>{formatDateTime(conversation.lastMessageAt)}</DetailValue>
              <DetailValue label={t('chatAdmin.detail.endedReason')}>{endedReasonLabel(conversation.endedReason, t)}</DetailValue>
            </dl>
      </DetailSection>

      <DetailSection title={t('chatAdmin.detail.assistedOrders')} headingLevel={2}>
            {conversation.orderAttributions.length > 0 ? (
              <ul className="grid gap-3">
                {conversation.orderAttributions.map((attribution) => (
                  <li key={attribution.orderLineItemId || `${attribution.orderId}-${attribution.createdAt}`} className="rounded-[var(--admin-radius-card)] border border-border bg-surface-muted p-3">
                    <Button type="button" variant="link" className="h-auto p-0 font-mono text-sm" onClick={() => navigate(`/admin/orders/${attribution.orderId}`)}>
                      {t('chatAdmin.detail.openOrder', { id: attribution.orderId.slice(0, 8) })}
                    </Button>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatVnd(attribution.attributedAmount, locale)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(attribution.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">{t('chatAdmin.detail.noAssistedOrders')}</p>}
      </DetailSection>

      <DetailSection title={t('chatAdmin.detail.lead')} headingLevel={2}>
            {conversation.lead ? (
              <dl className="grid gap-4">
                <DetailValue label={t('chatAdmin.detail.leadName')}>{conversation.lead.name}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.phone')}>{conversation.lead.phone}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.note')}>{conversation.lead.note || t('chatAdmin.detail.none')}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.contactSource')}>{leadSourceLabel(conversation.lead.source, t)}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.consentedAt')}>{formatDateTime(conversation.lead.consentedAt)}</DetailValue>
              </dl>
            ) : <p className="text-sm text-muted-foreground">{t('chatAdmin.detail.noLead')}</p>}
      </DetailSection>
        </aside>
      </div>
    </Screen>
  )
}
