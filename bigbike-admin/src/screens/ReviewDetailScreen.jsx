import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Copy, ExternalLink, EyeOff, Image as ImageIcon, Loader2, RefreshCw, Trash2, Undo2, X } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DetailSection } from '../components/DetailSection'
import { MediaPreviewLightbox } from '../components/MediaPreviewLightbox'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { ReviewModerationNote } from '../components/ReviewModerationNote'
import { ReviewStars } from '../components/ReviewStars'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { Screen, ScreenHeader, StickyActionBar } from '../components/layout'
import { showConfirm } from '../lib/confirm'
import { deleteReview, fetchReviewDetail, updateReviewStatus } from '../lib/adminApi'
import { resolveDisplayUrl } from '../lib/contracts'
import { useContentLang } from '../lib/contentLang'
import { formatDateTime, formatText } from '../lib/formatters'
import { canPermanentlyDeleteReview, getReviewStatusTargets } from '../lib/reviewModeration'
import { recordRecentItem } from '../lib/useRecentItems'
import { toast } from '@/lib/toast'

function readListQuery() {
  try { return sessionStorage.getItem('reviews:listQuery') || '' } catch { return '' }
}

function DetailRow({ label, children }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-2 sm:items-center sm:gap-4">
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="m-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  )
}

function PhotoButton({ url, index, alt, onOpen, t }) {
  const [state, setState] = useState('loading')
  return (
    <Button
      variant="unstyled"
      type="button"
      onClick={onOpen}
      aria-label={t('reviews.detail.openPhoto', { index: index + 1 })}
      className="group relative block size-24 overflow-hidden rounded-sm border border-border bg-surface-muted p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-28"
    >
      {state === 'loading' ? <span className="absolute inset-0 flex items-center justify-center text-muted-foreground"><Loader2 size={18} className="animate-spin" /></span> : null}
      {state === 'error' ? <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-xs text-danger"><X size={18} />{t('reviews.detail.imageLoadError')}</span> : null}
      <img src={resolveDisplayUrl(url)} alt={alt} loading="lazy" onLoad={() => setState('loaded')} onError={() => setState('error')} className={state === 'error' ? 'hidden' : 'size-full object-cover transition group-hover:scale-105'} />
    </Button>
  )
}

export function ReviewDetailScreen({ reviewId, navigate, canUpdate, isSuperAdmin = false }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [state, setState] = useState({ status: 'loading', item: null, error: '', refreshing: false })
  const [pendingAction, setPendingAction] = useState(null)
  const [photoIndex, setPhotoIndex] = useState(null)
  const [copyState, setCopyState] = useState('idle')
  const [actionError, setActionError] = useState('')
  const [stale, setStale] = useState(false)

  const loadReview = useCallback(async ({ refresh = false } = {}) => {
    setState((current) => ({ ...current, status: refresh ? current.status : 'loading', error: '', refreshing: refresh }))
    try {
      const result = await fetchReviewDetail(reviewId)
      setState({ status: 'success', item: result.item, error: '', refreshing: false })
      setStale(false)
    } catch (error) {
      if (error?.status === 404) {
        setState({ status: 'not-found', item: null, error: '', refreshing: false })
        return
      }
      setState((current) => ({ status: refresh && current.item ? 'success' : 'error', item: refresh ? current.item : null, error: error.message, refreshing: false }))
    }
  }, [reviewId])

  useEffect(() => { loadReview(); return undefined }, [loadReview])

  useEffect(() => {
    if (state.item?.id) recordRecentItem('recent:reviews', { id: state.item.id, label: formatText(state.item.authorName, `#${state.item.id}`) })
  }, [state.item?.id, state.item?.authorName])

  const confirmStatusChange = useCallback(async (nextStatus) => {
    if (nextStatus === 'PENDING') return true
    const confirmation = {
      APPROVED: {
        message: t('reviews.approveConfirmMany', { count: 1 }),
        title: t('reviews.approveConfirmTitle'),
        label: t('reviews.approve'),
        variant: 'default',
      },
      SPAM: {
        message: t('reviews.spamConfirmMany', { count: 1 }),
        title: t('reviews.spamConfirmTitle'),
        label: t('reviews.spam'),
        variant: 'default',
      },
      TRASH: {
        message: t('reviews.trashConfirmMany', { count: 1 }),
        title: t('reviews.trashConfirmTitle'),
        label: t('reviews.moveToTrash'),
        variant: 'default',
      },
    }[nextStatus]
    if (!confirmation) return false
    return showConfirm(
      confirmation.message,
      confirmation.title,
      { variant: confirmation.variant, confirmLabel: confirmation.label, cancelLabel: t('common.cancel') },
    )
  }, [t])

  const handleStatusChange = useCallback(async (nextStatus) => {
    if (pendingAction || stale) return
    if (!getReviewStatusTargets(state.item?.status).includes(nextStatus)) return
    if (!(await confirmStatusChange(nextStatus))) return
    setActionError('')
    setPendingAction(nextStatus)
    try {
      const result = await updateReviewStatus(reviewId, nextStatus, state.item?.version ?? 0)
      setState((current) => ({ ...current, item: { ...current.item, ...result.item } }))
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
      await queryClient.invalidateQueries({ queryKey: ['review-summary'] })
      toast.success(t('reviews.detail.statusUpdated'))
    } catch (error) {
      if (error?.status === 409) {
        const message = t('reviews.staleConflict')
        setStale(true)
        setActionError(message)
        toast.error(message)
        await loadReview({ refresh: true })
      } else {
        const message = error.message || t('reviews.statusUpdateError')
        setActionError(message)
        toast.error(message)
      }
    } finally {
      setPendingAction(null)
    }
  }, [confirmStatusChange, loadReview, pendingAction, queryClient, reviewId, stale, state.item?.status, state.item?.version, t])

  const handleDelete = useCallback(async () => {
    if (pendingAction || stale || !canPermanentlyDeleteReview(state.item, isSuperAdmin)) return
    const confirmed = await showConfirm(
      t('reviews.deleteConfirmPermanent', { count: 1, defaultValue: 'Xoá vĩnh viễn đánh giá này. Không thể hoàn tác; đánh giá và ảnh đính kèm sẽ bị xoá.' }),
      t('common.permanentDeleteTitle'),
      { variant: 'danger', confirmLabel: t('common.permanentDelete'), cancelLabel: t('common.cancel') },
    )
    if (!confirmed) return
    setActionError('')
    setPendingAction('DELETE')
    try {
      await deleteReview(reviewId, state.item?.version ?? 0)
      await queryClient.invalidateQueries({ queryKey: ['reviews'] })
      await queryClient.invalidateQueries({ queryKey: ['review-summary'] })
      toast.success(t('reviews.detail.deleteSuccess'))
      navigate(`/admin/reviews${readListQuery()}`)
    } catch (error) {
      if (error?.status === 409) {
        const message = t('reviews.staleConflict')
        setStale(true)
        setActionError(message)
        toast.error(message)
        await loadReview({ refresh: true })
      } else {
        const message = error.message || t('reviews.deleteError')
        setActionError(message)
        toast.error(message)
      }
    } finally {
      setPendingAction(null)
    }
  }, [isSuperAdmin, loadReview, navigate, pendingAction, queryClient, reviewId, stale, state.item, t])

  const copyEmail = useCallback(async () => {
    const email = state.item?.authorEmail
    if (!email) return
    try {
      await navigator.clipboard.writeText(email)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setCopyState('error')
    }
  }, [state.item?.authorEmail])

  if (state.status === 'loading' && !state.item) return <Screen><StatePanel tone="info" title={t('reviews.detail.loading')} description={t('common.pleaseWait')} /></Screen>
  if (state.status === 'error' && !state.item) return <Screen><StatePanel tone="danger" title={t('reviews.detail.error')} description={state.error} actionLabel={t('common.retry')} onAction={() => loadReview()} /></Screen>
  if (state.status === 'not-found') return <Screen><StatePanel tone="neutral" title={t('reviews.detail.notFound')} description={`ID: ${reviewId}`} actionLabel={t('common.back')} onAction={() => navigate('/admin/reviews')} /></Screen>
  if (!state.item) return <Screen><StatePanel tone="neutral" title={t('reviews.detail.notFound')} description={`ID: ${reviewId}`} actionLabel={t('common.back')} onAction={() => navigate('/admin/reviews')} /></Screen>

  const review = state.item
  const statusTargets = getReviewStatusTargets(review.status)
  const productName = formatText(contentLang === 'en' ? (review.productNameEn || review.productName) : review.productName, t('reviews.unknownProduct'))
  const authorName = formatText(review.authorName, t('reviews.unknownAuthor'))
  const actionButtons = (
    <div className="flex flex-wrap gap-2">
      {canUpdate && statusTargets.includes('APPROVED') ? <Button type="button" variant="secondary" className="min-h-11" disabled={Boolean(pendingAction) || stale} loading={pendingAction === 'APPROVED'} onClick={() => handleStatusChange('APPROVED')}><Check size={16} />{t('reviews.approve')}</Button> : null}
      {canUpdate && statusTargets.includes('SPAM') ? <Button type="button" variant="outline" className="min-h-11 text-danger" disabled={Boolean(pendingAction) || stale} loading={pendingAction === 'SPAM'} onClick={() => handleStatusChange('SPAM')}><EyeOff size={16} />{t('reviews.spam')}</Button> : null}
      {canUpdate && statusTargets.includes('TRASH') ? <Button type="button" variant="outline" className="min-h-11 text-danger" disabled={Boolean(pendingAction) || stale} loading={pendingAction === 'TRASH'} onClick={() => handleStatusChange('TRASH')}><Trash2 size={16} />{t('reviews.moveToTrash')}</Button> : null}
      {canUpdate && statusTargets.includes('PENDING') ? <Button type="button" variant="secondary" className="min-h-11" disabled={Boolean(pendingAction) || stale} loading={pendingAction === 'PENDING'} onClick={() => handleStatusChange('PENDING')}><Undo2 size={16} />{review.status === 'TRASH' ? t('reviews.restore') : t('reviews.returnPending')}</Button> : null}
      {canUpdate && canPermanentlyDeleteReview(review, isSuperAdmin) ? <Button type="button" variant="danger" className="min-h-11" disabled={Boolean(pendingAction) || stale} loading={pendingAction === 'DELETE'} onClick={handleDelete}><Trash2 size={16} />{t('reviews.deletePermanent')}</Button> : null}
      {!canUpdate ? <span className="self-center text-sm text-muted-foreground">{t('reviews.detail.noActionPermission')}</span> : null}
      {canUpdate && review.status === 'TRASH' && !isSuperAdmin ? <span className="self-center text-sm text-muted-foreground">{t('reviews.detail.superAdminDeleteHint')}</span> : null}
    </div>
  )

  return (
    <Screen>
      <ScreenHeader
        group="sales"
        title={t('reviews.detail.title')}
        description={productName}
        badge={<StatusBadge type="review" status={review.status} />}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => navigate(`/admin/reviews${readListQuery()}`)}>{t('reviews.detail.backToList')}</Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => loadReview({ refresh: true })} disabled={state.refreshing}><RefreshCw size={16} className={state.refreshing ? 'animate-spin' : ''} />{state.refreshing ? t('reviews.refreshing') : t('reviews.refresh')}</Button>
          </div>
        )}
      />

      {state.refreshing ? <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 size={16} className="animate-spin" />{t('reviews.refreshing')}</div> : null}
      {state.error && state.item ? <Alert tone="danger"><div className="flex flex-wrap items-center justify-between gap-3"><span>{state.error}</span><Button type="button" variant="ghost" className="min-h-11" onClick={() => loadReview({ refresh: true })}>{t('common.retry')}</Button></div></Alert> : null}
      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
      {!canUpdate ? <ReadOnlyBanner warning={t('reviews.detail.readOnlyHint')} /> : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          <DetailSection title={t('reviews.detail.sectionReview')}>
            <dl className="m-0">
              <DetailRow label={t('reviews.colStatus')}><StatusBadge type="review" status={review.status} /></DetailRow>
              <DetailRow label={t('reviews.colRating')}>
                {Number.isFinite(review.rating)
                  ? <span className="inline-flex items-center gap-2"><ReviewStars rating={review.rating} /><span>{review.rating}/5</span></span>
                  : <span className="text-muted-foreground">—</span>}
              </DetailRow>
              <DetailRow label={t('reviews.colAuthor')}><span className="font-semibold">{authorName}</span></DetailRow>
              <DetailRow label={t('reviews.detail.authorEmail')}><span className="inline-flex flex-wrap items-center gap-2">{formatText(review.authorEmail, t('reviews.detail.emailMissing'))}{review.authorEmail ? <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={copyEmail}><Copy size={16} />{copyState === 'copied' ? t('reviews.detail.emailCopied') : t('reviews.detail.copyEmail')}</Button> : null}</span></DetailRow>
              <DetailRow label={t('reviews.colDate')}>{formatDateTime(review.createdAt)}</DetailRow>
              <DetailRow label={t('reviews.detail.updatedAt')}>{formatDateTime(review.updatedAt)}</DetailRow>
            </dl>
            {copyState === 'error' ? <p className="mt-3 mb-0 text-sm text-danger">{t('reviews.detail.emailCopyError')}</p> : null}
          </DetailSection>

          <DetailSection
            title={t('reviews.moderation.sectionTitle')}
            description={t('reviews.moderation.sectionDescription')}
          >
            <ReviewModerationNote review={review} />
          </DetailSection>

          <DetailSection title={t('reviews.detail.sectionProduct')}>
            <dl className="m-0">
              <DetailRow label={t('reviews.detail.productName')}>{productName}</DetailRow>
              <DetailRow label={t('reviews.detail.productSlug')}>{formatText(review.productSlug, t('reviews.detail.missingValue'))}</DetailRow>
              <DetailRow label={t('reviews.detail.productId')}>{formatText(review.productId, t('reviews.detail.missingValue'))}</DetailRow>
            </dl>
            {review.productId ? <Button type="button" variant="secondary" className="mt-4 min-h-11" title={t('reviews.productLinkHint')} onClick={() => navigate(`/admin/products/${review.productId}`)}><ExternalLink size={16} />{t('reviews.detail.openProduct')}</Button> : null}
          </DetailSection>

          <DetailSection title={t('reviews.detail.sectionContent')}>
            <p className="m-0 whitespace-pre-wrap break-words leading-relaxed">{formatText(review.body, t('reviews.contentMissing'))}</p>
          </DetailSection>

          <DetailSection title={t('reviews.detail.sectionPhotos')} description={t('reviews.detail.photoLimitHint')}>
            {review.photos?.length ? <div className="flex flex-wrap gap-3">{review.photos.map((url, index) => <PhotoButton key={`${url}-${index}`} url={url} index={index} alt={t('reviews.detail.photoAlt', { index: index + 1, author: authorName, product: productName })} onOpen={() => setPhotoIndex(index)} t={t} />)}</div> : <div className="flex items-center gap-2 text-sm text-muted-foreground"><ImageIcon size={18} />{t('reviews.detail.noPhotos')}</div>}
          </DetailSection>
        </div>

        <aside className="hidden h-fit lg:sticky lg:top-4 lg:block">
          <DetailSection title={t('reviews.detail.sectionActions')} description={canPermanentlyDeleteReview(review, isSuperAdmin) ? t('reviews.detail.permanentDeleteHint') : t('reviews.detail.lifecycleHint')}>
            {actionButtons}
          </DetailSection>
        </aside>
      </div>

      <div className="lg:hidden">
        <StickyActionBar ariaLabel={t('reviews.detail.sectionActions')} info={canUpdate ? t('reviews.detail.mobileActionHint') : t('reviews.detail.noActionPermission')}>
          {actionButtons}
        </StickyActionBar>
      </div>

      {photoIndex !== null && review.photos?.length ? <MediaPreviewLightbox items={review.photos.map((url, index) => ({ publicUrl: resolveDisplayUrl(url), mimeType: 'image/jpeg', filename: `review-${review.id}-${index + 1}`, altText: t('reviews.detail.photoAlt', { index: index + 1, author: authorName, product: productName }) }))} index={photoIndex} onClose={() => setPhotoIndex(null)} onNavigate={setPhotoIndex} /> : null}
    </Screen>
  )
}
