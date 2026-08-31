import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bot, Loader2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { Screen, ScreenHeader } from '../components/layout'
import { fetchAdminChatImageBlob, fetchChatConversation } from '../lib/adminApi'
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
    RULE: t('chatAdmin.detail.sources.rule'),
    TEMPLATE: t('chatAdmin.detail.sources.rule'),
    TOOL: t('chatAdmin.detail.sources.data'),
    CONTACT_FALLBACK: t('chatAdmin.detail.sources.contact'),
    PROVIDER_UNAVAILABLE: t('chatAdmin.detail.sources.providerUnavailable'),
    OUT_OF_SCOPE: t('chatAdmin.detail.sources.outOfScope'),
    CONTENT_REFUSAL: t('chatAdmin.detail.sources.contentRefusal'),
    ROLE_DEFENSE: t('chatAdmin.detail.sources.roleDefense'),
  }
  return labels[source] || t('common.unknown')
}

function endedReasonLabel(reason, t) {
  if (!reason) return t('chatAdmin.detail.active')
  const labels = {
    TURN_LIMIT: t('chatAdmin.detail.endStates.turnLimit'),
    CONTINUED: t('chatAdmin.detail.endStates.continued'),
    OFF_TOPIC: t('chatAdmin.detail.endStates.offTopic'),
    AI_UNAVAILABLE: t('chatAdmin.detail.endStates.unavailable'),
    DAILY_LIMIT_REACHED: t('chatAdmin.detail.endStates.dailyLimit'),
    DISABLED: t('chatAdmin.detail.endStates.disabled'),
    CLOSED: t('chatAdmin.detail.endStates.closed'),
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
  const { t } = useTranslation()
  const detailQuery = useQuery({
    queryKey: ['chat-conversation', conversationId],
    queryFn: () => fetchChatConversation(conversationId),
    enabled: Boolean(conversationId),
  })
  const conversation = detailQuery.data?.item
  const messages = useMemo(
    () => [...(conversation?.messages ?? [])].sort((left, right) => (
      (left.sequenceNo || 0) - (right.sequenceNo || 0)
    )),
    [conversation?.messages],
  )

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
        group="sales"
        title={t('chatAdmin.detail.title')}
        actions={<Button variant="secondary" onClick={() => navigate('/admin/chat')}><ArrowLeft size={16} aria-hidden="true" />{t('common.back')}</Button>}
      />

      <ReadOnlyBanner warning={t('chatAdmin.detail.readOnly')} />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DetailSection title={t('chatAdmin.detail.messages')} description={t('chatAdmin.detail.messagesDescription')}>
            {messages.length > 0 ? <ol className="grid gap-4">
              {messages.map((message) => {
                const isUser = message.role === 'USER' || message.role === 'CUSTOMER'
                const isSystem = message.role === 'SYSTEM'
                const Icon = isUser ? UserRound : Bot
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
                    {!isUser ? <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true"><Icon size={17} /></span> : null}
                    <article className={`max-w-2xl rounded-md border p-4 ${isUser ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface'}`}>
                      <header className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{isUser ? t('chatAdmin.detail.customer') : t('chatAdmin.detail.bigbike')}</span>
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
                      {!isUser ? (
                        <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                          <p>{t('chatAdmin.detail.source')}: <span className="font-semibold text-foreground">{sourceLabel(message.source, t)}</span></p>
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

        <aside className="grid h-fit content-start gap-4 lg:sticky lg:top-4">
          <DetailSection title={t('chatAdmin.detail.summary')} headingLevel={2}>
            <dl data-testid="chat-detail-summary" className="grid gap-4">
              <DetailValue label={t('chatAdmin.columns.language')}>{String(conversation.locale || '—').toUpperCase()}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.turns')}>{conversation.turnCount}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.startedAt')}>{formatDateTime(conversation.startedAt)}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.lastMessage')}>{formatDateTime(conversation.lastMessageAt)}</DetailValue>
              <DetailValue label={t('chatAdmin.detail.endedReason')}>{endedReasonLabel(conversation.endedReason, t)}</DetailValue>
            </dl>
          </DetailSection>
        </aside>
      </div>
    </Screen>
  )
}
