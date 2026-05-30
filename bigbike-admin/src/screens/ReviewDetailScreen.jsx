import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { deleteReview, fetchReviewDetail, updateReviewStatus } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const STATUS_VARIANTS = { APPROVED: 'success', PENDING: 'warning', SPAM: 'muted', TRASH: 'muted' }

function ReviewStatusBadge({ review, t }) {
  return (
    <Badge variant={STATUS_VARIANTS[review.status] ?? 'muted'}>
      {t(`reviews.status${review.status.charAt(0) + review.status.slice(1).toLowerCase()}`, {
        defaultValue: review.status,
      })}
    </Badge>
  )
}

export function ReviewDetailScreen({ reviewId, navigate, canUpdate }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', item: null, warning: '' })
  const [busy, setBusy] = useState(false)

  const loadReview = useCallback(() => {
    let active = true
    fetchReviewDetail(reviewId)
      .then((result) => {
        if (!active) return
        setState({
          status: 'success',
          item: result.item,
          warning: '',
        })
      })
      .catch((error) => {
        if (!active) return
        setState({ status: 'error', item: null, warning: '', error: error.message })
      })
    return () => { active = false }
  }, [reviewId])

  useEffect(() => loadReview(), [loadReview])

  const handleStatusChange = useCallback(async (nextStatus) => {
    setBusy(true)
    try {
      const result = await updateReviewStatus(reviewId, nextStatus)
      setState((prev) => ({ ...prev, item: result.item }))
      toast.success(t('reviews.detail.statusUpdated'))
    } catch (error) {
      toast.error(error.message || t('reviews.approveError'))
    } finally {
      setBusy(false)
    }
  }, [reviewId, t])

  const handleDelete = useCallback(async () => {
    const confirmed = await showConfirm(t('reviews.deleteConfirm'), t('reviews.deleteConfirmTitle'))
    if (!confirmed) return

    setBusy(true)
    try {
      await deleteReview(reviewId)
      toast.success(t('reviews.detail.deleteSuccess'))
      navigate('/admin/reviews')
    } catch (error) {
      toast.error(error.message || t('reviews.deleteError'))
    } finally {
      setBusy(false)
    }
  }, [navigate, reviewId, t])

  if (state.status === 'loading') {
    return <StatePanel tone="info" title={t('reviews.detail.loading')} description={t('common.pleaseWait')} />
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('reviews.detail.error')}
        description={state.error}
        actionLabel={t('common.back')}
        onAction={() => navigate('/admin/reviews')}
      />
    )
  }

  if (!state.item) {
    return (
      <StatePanel
        tone="neutral"
        title={t('reviews.detail.notFound')}
        description={`ID: ${reviewId}`}
        actionLabel={t('common.back')}
        onAction={() => navigate('/admin/reviews')}
      />
    )
  }

  const review = state.item

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('reviews.eyebrow')}</p>
          <h1>{t('reviews.detail.title')}</h1>
          <p className="bb-muted">{formatText(review.productName, review.productId || t('reviews.unknownProduct'))}</p>
        </div>
        <div className="bb-screen-actions">
          <Button variant="secondary" type="button" onClick={() => navigate('/admin/reviews')}>
            {t('reviews.detail.backToList')}
          </Button>
        </div>
      </div>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <DetailSection title={t('reviews.detail.sectionReview')}>
          <div className="grid gap-3">
            <p><strong>{t('reviews.colAuthor')}</strong> {formatText(review.authorName, '(---)')}</p>
            <p><strong>{t('reviews.detail.authorEmail')}</strong> {formatText(review.authorEmail, '(---)')}</p>
            <p><strong>{t('reviews.colRating')}</strong> {review.rating}</p>
            <p><strong>{t('reviews.colStatus')}</strong> <ReviewStatusBadge review={review} t={t} /></p>
            <p><strong>{t('reviews.colDate')}</strong> {formatDateTime(review.createdAt)}</p>
            <p><strong>{t('reviews.detail.updatedAt')}</strong> {formatDateTime(review.updatedAt)}</p>
          </div>
        </DetailSection>

        <DetailSection title={t('reviews.detail.sectionProduct')}>
          <div className="grid gap-3">
            <p><strong>{t('reviews.detail.productName')}</strong> {formatText(review.productName, t('reviews.unknownProduct'))}</p>
            <p><strong>{t('reviews.detail.productSlug')}</strong> {formatText(review.productSlug, '(---)')}</p>
            <p><strong>{t('reviews.detail.productId')}</strong> {formatText(review.productId, '(---)')}</p>
            {review.productId ? (
              <Button variant="secondary" type="button" onClick={() => navigate(`/admin/products/${review.productId}`)}>
                {t('reviews.detail.openProduct')}
              </Button>
            ) : null}
          </div>
        </DetailSection>

        <DetailSection title={t('reviews.detail.sectionContent')}>
          <p className="m-0 whitespace-pre-wrap leading-relaxed">
            {formatText(review.body, '(---)')}
          </p>
        </DetailSection>

        <DetailSection title={t('reviews.detail.sectionActions')}>
          <div className="flex gap-2 flex-wrap">
            {canUpdate && review.status !== 'APPROVED' ? (
              <Button variant="secondary" type="button" disabled={busy} onClick={() => handleStatusChange('APPROVED')}>
                {t('reviews.approve')}
              </Button>
            ) : null}
            {canUpdate && review.status !== 'SPAM' ? (
              <Button variant="secondary" type="button" disabled={busy} onClick={() => handleStatusChange('SPAM')}>
                {t('reviews.spam')}
              </Button>
            ) : null}
            {canUpdate ? (
              <Button variant="danger" type="button" disabled={busy} onClick={handleDelete}>
                {t('common.delete')}
              </Button>
            ) : null}
          </div>
        </DetailSection>
      </div>
    </div>
  )
}
