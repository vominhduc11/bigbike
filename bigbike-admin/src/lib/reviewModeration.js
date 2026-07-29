const REVIEW_STATUS_TARGETS = Object.freeze({
  PENDING: Object.freeze(['APPROVED', 'SPAM', 'TRASH']),
  APPROVED: Object.freeze(['PENDING']),
  SPAM: Object.freeze(['PENDING']),
  TRASH: Object.freeze(['PENDING']),
})

export function getReviewStatusTargets(status) {
  return REVIEW_STATUS_TARGETS[String(status || '').toUpperCase()] || []
}

export function canPermanentlyDeleteReview(review, isSuperAdmin) {
  return Boolean(isSuperAdmin && review?.status === 'TRASH')
}

export function toVersionedReviewItems(reviews) {
  const unique = new Map()
  for (const review of reviews || []) {
    if (review?.id === null || review?.id === undefined) continue
    const version = Number(review.version)
    if (!Number.isInteger(version) || version < 0) continue
    const key = String(review.id)
    if (!unique.has(key)) unique.set(key, { id: review.id, expectedVersion: version })
  }
  return [...unique.values()]
}

export function hasReviewStatusTarget(reviews, targetStatus) {
  return (reviews || []).some((review) => getReviewStatusTargets(review?.status).includes(targetStatus))
}
