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
      <dd className="mt-1 text-sm text-foreground">{children || '—'}</dd>
    </div>
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

  if (detailQuery.isLoading) {
    return <Screen><StatePanel tone="info" title={t('chatAdmin.detail.loading')} description={t('chatAdmin.detail.loadingDescription')} /></Screen>
  }
  if (detailQuery.isError || !conversation) {
    return (
      <Screen>
        <StatePanel
          tone="danger"
          title={t('chatAdmin.detail.loadError')}
          description={detailQuery.error?.message || t('chatAdmin.detail.notFound')}
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
            <ol className="grid gap-4">
              {conversation.messages.map((message) => {
                const isUser = message.role === 'USER'
                const Icon = isUser ? UserRound : Bot
                return (
                  <li key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser ? <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true"><Icon size={17} /></span> : null}
                    <article className={`max-w-2xl rounded-md border p-4 ${isUser ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface'}`}>
                      <header className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{isUser ? t('chatAdmin.detail.customer') : t('chatAdmin.detail.bi')}</span>
                        <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
                      </header>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.content || t('common.unknown')}</p>
                      {!isUser ? <p className="mt-2 text-xs text-muted-foreground">{t('chatAdmin.detail.source')}: {message.source || t('common.unknown')}{message.aiCalled ? ` · ${t('chatAdmin.detail.usedAi')}` : ''}</p> : null}
                    </article>
                    {isUser ? <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground" aria-hidden="true"><Icon size={17} /></span> : null}
                  </li>
                )
              })}
            </ol>
          </DetailSection>
        </div>

        <aside className="grid content-start gap-4">
          <SectionCard title={t('chatAdmin.detail.summary')} headingLevel={2}>
            <dl className="grid gap-4">
              <DetailValue label={t('chatAdmin.columns.language')}>{conversation.locale.toUpperCase()}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.turns')}>{conversation.turnCount}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.aiCalls')}>{conversation.aiCallCount}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.startedAt')}>{formatDateTime(conversation.startedAt)}</DetailValue>
              <DetailValue label={t('chatAdmin.columns.lastMessage')}>{formatDateTime(conversation.lastMessageAt)}</DetailValue>
              <DetailValue label={t('chatAdmin.detail.endedReason')}>{conversation.endedReason || t('chatAdmin.detail.active')}</DetailValue>
            </dl>
          </SectionCard>

          <SectionCard title={t('chatAdmin.detail.lead')} headingLevel={2}>
            {conversation.lead ? (
              <dl className="grid gap-4">
                <DetailValue label={t('chatAdmin.detail.leadName')}>{conversation.lead.name}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.phone')}>{conversation.lead.phone}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.note')}>{conversation.lead.note || t('chatAdmin.detail.none')}</DetailValue>
                <DetailValue label={t('chatAdmin.detail.consentedAt')}>{formatDateTime(conversation.lead.consentedAt)}</DetailValue>
              </dl>
            ) : <p className="text-sm text-muted-foreground">{t('chatAdmin.detail.noLead')}</p>}
          </SectionCard>
        </aside>
      </div>
    </Screen>
  )
}
