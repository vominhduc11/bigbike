import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { deleteReview, fetchReviewDetail, updateReviewStatus } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'

const STATUS_TONES = { APPROVED: 'success', PENDING: 'warning', SPAM: 'neutral', TRASH: 'neutral' }

function ReviewStatusBadge({ review, t }) {
  return (
    <span className={`status-badge status-${STATUS_TONES[review.status] || 'neutral'}`}>
      {t(`reviews.status${review.status.charAt(0) + review.status.slice(1).toLowerCase()}`, {
        defaultValue: review.status,
      })}
    </span>
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
          warning: result.mode === 'mock' ? result.warning : '',
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
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('reviews.eyebrow')}</p>
          <h1>{t('reviews.detail.title')}</h1>
          <p>{formatText(review.productName, review.productId || t('reviews.unknownProduct'))}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/reviews')}>
          {t('reviews.detail.backToList')}
        </button>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <DetailSection title={t('reviews.detail.sectionReview')}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <p><strong>{t('reviews.colAuthor')}</strong> {formatText(review.authorName, '(---)')}</p>
            <p><strong>{t('reviews.detail.authorEmail')}</strong> {formatText(review.authorEmail, '(---)')}</p>
            <p><strong>{t('reviews.colRating')}</strong> {review.rating}</p>
            <p><strong>{t('reviews.colStatus')}</strong> <ReviewStatusBadge review={review} t={t} /></p>
            <p><strong>{t('reviews.colDate')}</strong> {formatDateTime(review.createdAt)}</p>
            <p><strong>{t('reviews.detail.updatedAt')}</strong> {formatDateTime(review.updatedAt)}</p>
          </div>
        </DetailSection>

        <DetailSection title={t('reviews.detail.sectionProduct')}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <p><strong>{t('reviews.detail.productName')}</strong> {formatText(review.productName, t('reviews.unknownProduct'))}</p>
            <p><strong>{t('reviews.detail.productSlug')}</strong> {formatText(review.productSlug, '(---)')}</p>
            <p><strong>{t('reviews.detail.productId')}</strong> {formatText(review.productId, '(---)')}</p>
            {review.productId ? (
              <button type="button" className="btn btn-secondary" onClick={() => navigate(`/admin/products/${review.productId}`)}>
                {t('reviews.detail.openProduct')}
              </button>
            ) : null}
          </div>
        </DetailSection>

        <DetailSection title={t('reviews.detail.sectionContent')}>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {formatText(review.body, '(---)')}
          </p>
        </DetailSection>

        <DetailSection title={t('reviews.detail.sectionActions')}>
          <div className="row-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            {canUpdate && review.status !== 'APPROVED' ? (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => handleStatusChange('APPROVED')}>
                {t('reviews.approve')}
              </button>
            ) : null}
            {canUpdate && review.status !== 'SPAM' ? (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => handleStatusChange('SPAM')}>
                {t('reviews.spam')}
              </button>
            ) : null}
            {canUpdate ? (
              <button type="button" className="btn btn-danger" disabled={busy} onClick={handleDelete}>
                {t('common.delete')}
              </button>
            ) : null}
          </div>
        </DetailSection>
      </div>
    </section>
  )
}
