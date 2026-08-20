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
  return (reviews || []).some((review) =>
    getReviewStatusTargets(review?.status).includes(targetStatus),
  )
}

// --- Kết quả kiểm duyệt tự động (REVIEW_RULE_012) ---------------------------------
// Bốn trạng thái hiển thị, cố ý tách "chưa chạy" khỏi "chạy rồi nhưng bỏ qua": người
// duyệt cần phân biệt được đánh giá cũ chưa từng qua máy lọc với đánh giá vừa lọt lưới
// vì AI lỗi. Gộp hai cái này lại là che mất một sự cố vận hành.
const AUTO_MODERATION_SKIP_REASONS = Object.freeze([
  'DISABLED',
  'NOT_CONFIGURED',
  'EMPTY_BODY',
  'AI_UNAVAILABLE',
  'DAILY_LIMIT_REACHED',
])

export function getAutoModerationState(review) {
  const source = String(review?.moderationSource || '')
  if (!source) return 'unchecked'
  if (source === 'SKIPPED') return 'skipped'
  return review?.moderationVerdict === 'BLOCKED' ? 'blocked' : 'clean'
}

/** Tone dùng chung cho badge/alert, để danh sách và chi tiết không lệch màu nhau. */
export function getAutoModerationTone(state) {
  return (
    { blocked: 'danger', skipped: 'warning', clean: 'success', unchecked: 'neutral' }[state] ||
    'neutral'
  )
}

/**
 * Khoá i18n cho lý do bỏ qua. Mã lạ (backend thêm mã mới mà admin chưa cập nhật) rơi về
 * khoá UNKNOWN thay vì hiện mã thô cho người không phải lập trình viên.
 */
export function getAutoModerationSkipReasonKey(reason) {
  const code = String(reason || '').toUpperCase()
  return AUTO_MODERATION_SKIP_REASONS.includes(code) ? code : 'UNKNOWN'
}

export function getAutoModerationCategories(review) {
  const categories = review?.moderationCategories
  return Array.isArray(categories) ? categories.filter(Boolean) : []
}
