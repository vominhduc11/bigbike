import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { recordRecentItem } from '@/lib/useRecentItems'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { MediaPreviewLightbox } from '../components/MediaPreviewLightbox'
import { showConfirm } from '../lib/confirm'
import { deleteReview, fetchReviewDetail, updateReviewStatus } from '../lib/adminApi'
import { resolveDisplayUrl } from '../lib/contracts'
import { useContentLang } from '../lib/contentLang'
import { formatDateTime, formatText } from '../lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useQueryClient } from '@tanstack/react-query'

const STATUS_VARIANTS = { APPROVED: 'success', PENDING: 'warning', SPAM: 'muted', TRASH: 'muted' }

// T9: đọc lại query string (filter/trang) mà ReviewListScreen đã lưu trước khi
// điều hướng sang trang chi tiết, để nút "Quay lại danh sách" không làm mất bộ lọc.
function readListQuery() {
  try {
    return sessionStorage.getItem('reviews:listQuery') || ''
  } catch {
    return ''
  }
}

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
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [state, setState] = useState({ status: 'loading', item: null, warning: '' })
  const [busy, setBusy] = useState(false)
  // Theo dõi đúng nút đang chạy để chỉ nút được bấm hiện spinner (APPROVED/SPAM/DELETE).
  const [pendingAction, setPendingAction] = useState(null)
  const [photoIndex, setPhotoIndex] = useState(null)

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

  // O9: ghi lại đánh giá vừa xem để hiện trong widget "Vừa xem gần đây" ở danh sách.
  useEffect(() => {
    if (state.item?.id) {
      recordRecentItem('recent:reviews', {
        id: state.item.id,
        label: formatText(state.item.authorName, `#${state.item.id}`),
      })
    }
  }, [state.item?.id, state.item?.authorName])

  const handleStatusChange = useCallback(async (nextStatus) => {
    if (busy) return
    // Đánh dấu spam là hành động kiểm duyệt ẩn đánh giá khỏi khách → xác nhận trước.
    if (nextStatus === 'SPAM') {
      const confirmed = await showConfirm(
        t('reviews.spamConfirm', { defaultValue: 'Đánh dấu đánh giá này là spam? Đánh giá sẽ không hiển thị cho khách.' }),
        t('reviews.spamConfirmTitle', { defaultValue: 'Đánh dấu spam' }),
      )
      if (!confirmed) return
    }
    setBusy(true)
    setPendingAction(nextStatus)
    try {
      const result = await updateReviewStatus(reviewId, nextStatus)
      setState((prev) => ({ ...prev, item: result.item }))
      // Đồng bộ lại danh sách đánh giá để badge/bộ lọc cập nhật khi quay lại.
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      toast.success(t('reviews.detail.statusUpdated'))
    } catch (error) {
      toast.error(error.message || t('reviews.approveError'))
    } finally {
      setBusy(false)
      setPendingAction(null)
    }
  }, [busy, reviewId, t, queryClient])

  const handleDelete = useCallback(async () => {
    if (busy) return
    const confirmed = await showConfirm(t('reviews.deleteConfirm'), t('reviews.deleteConfirmTitle'))
    if (!confirmed) return

    setBusy(true)
    setPendingAction('DELETE')
    try {
      await deleteReview(reviewId)
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      toast.success(t('reviews.detail.deleteSuccess'))
      // Giữ nguyên bộ lọc/trang đã lưu khi quay lại danh sách sau khi xoá.
      navigate(`/admin/reviews${readListQuery()}`)
    } catch (error) {
      toast.error(error.message || t('reviews.deleteError'))
    } finally {
      setBusy(false)
      setPendingAction(null)
    }
  }, [busy, navigate, reviewId, t, queryClient])

  if (state.status === 'loading') {
    return <StatePanel tone="info" title={t('reviews.detail.loading')} description={t('common.pleaseWait')} />
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('reviews.detail.error')}
        description={state.error}
        actionLabel={t('common.retry')}
        onAction={() => { setState({ status: 'loading', item: null, warning: '' }); loadReview() }}
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
  // Admin VI/EN switch: ở EN hiện tên SP tiếng Anh (backend trả kèm productNameEn).
  const reviewProductName = contentLang === 'en'
    ? (review.productNameEn || review.productName)
    : review.productName

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('reviews.eyebrow')}</p>
          <h1>{t('reviews.detail.title')}</h1>
          <p className="bb-muted break-words">{formatText(reviewProductName, review.productId || t('reviews.unknownProduct'))}</p>
        </div>
        <div className="bb-screen-actions">
          <Button variant="secondary" type="button" onClick={() => navigate(`/admin/reviews${readListQuery()}`)}>
            {t('reviews.detail.backToList')}
          </Button>
        </div>
      </div>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}
      {!canUpdate ? (
        <ReadOnlyBanner warning={t('reviews.detail.readOnlyHint', { defaultValue: 'Bạn chỉ có quyền xem đánh giá. Liên hệ quản trị để được cấp quyền kiểm duyệt.' })} />
      ) : null}

      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <DetailSection title={t('reviews.detail.sectionReview')}>
          <div className="grid gap-3">
            <p><strong>{t('reviews.colAuthor')}</strong> {formatText(review.authorName, '(---)')}</p>
            <p><strong>{t('reviews.detail.authorEmail')}</strong> {formatText(review.authorEmail, '(---)')}</p>
            <p className="flex items-center gap-2">
              <strong>{t('reviews.colRating')}</strong>
              <span className="inline-flex gap-px" role="img" aria-label={`${t('reviews.colRating')}: ${review.rating}/5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} aria-hidden="true" style={{ color: i < Math.round(review.rating) ? 'var(--admin-color-rating-star)' : 'var(--admin-color-border-default)' }}>★</span>
                ))}
              </span>
              <span>{review.rating}/5</span>
            </p>
            <p><strong>{t('reviews.colStatus')}</strong> <ReviewStatusBadge review={review} t={t} /></p>
            <p><strong>{t('reviews.colDate')}</strong> {formatDateTime(review.createdAt)}</p>
            <p><strong>{t('reviews.detail.updatedAt')}</strong> {formatDateTime(review.updatedAt)}</p>
          </div>
        </DetailSection>

        <DetailSection title={t('reviews.detail.sectionProduct')}>
          <div className="grid gap-3">
            <p><strong>{t('reviews.detail.productName')}</strong> {formatText(reviewProductName, t('reviews.unknownProduct'))}</p>
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
          <p className="m-0 whitespace-pre-wrap leading-relaxed break-words">
            {formatText(review.body, '(---)')}
          </p>
        </DetailSection>

        {review.photos?.length > 0 ? (
          <DetailSection title={t('reviews.detail.sectionPhotos')}>
            <div className="flex flex-wrap gap-2">
              {review.photos.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => setPhotoIndex(i)}
                  aria-label={t('reviews.detail.openPhoto', { index: i + 1 })}
                  className="block size-20 overflow-hidden rounded-sm border border-border bg-surface-muted p-0 cursor-pointer"
                >
                  <img src={resolveDisplayUrl(url)} alt={t('reviews.detail.photoAlt', { index: i + 1 })} loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          </DetailSection>
        ) : null}

        <DetailSection title={t('reviews.detail.sectionActions')}>
          <div className="flex gap-2 flex-wrap">
            {canUpdate && review.status !== 'APPROVED' ? (
              <Button variant="secondary" type="button" disabled={busy} loading={pendingAction === 'APPROVED'} onClick={() => handleStatusChange('APPROVED')}>
                {t('reviews.approve')}
              </Button>
            ) : null}
            {canUpdate && review.status !== 'SPAM' ? (
              <Button variant="secondary" type="button" disabled={busy} loading={pendingAction === 'SPAM'} onClick={() => handleStatusChange('SPAM')}>
                {t('reviews.spam')}
              </Button>
            ) : null}
            {canUpdate ? (
              <Button variant="danger" type="button" disabled={busy} loading={pendingAction === 'DELETE'} onClick={handleDelete}>
                {t('common.delete')}
              </Button>
            ) : null}
            {!canUpdate ? (
              <p className="bb-muted text-sm m-0">
                {t('reviews.detail.noActionPermission', { defaultValue: 'Bạn không có quyền kiểm duyệt đánh giá này.' })}
              </p>
            ) : null}
          </div>
        </DetailSection>
      </div>

      {photoIndex !== null && review.photos?.length > 0 ? (
        <MediaPreviewLightbox
          items={review.photos.map((url) => ({
            publicUrl: resolveDisplayUrl(url),
            mimeType: 'image/jpeg',
            filename: typeof url === 'string' ? url.split('/').pop() : '',
          }))}
          index={photoIndex}
          onClose={() => setPhotoIndex(null)}
          onNavigate={setPhotoIndex}
        />
      ) : null}
    </div>
  )
}
