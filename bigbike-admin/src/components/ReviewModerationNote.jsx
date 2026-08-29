import { useTranslation } from 'react-i18next'
import { Bot, CircleSlash, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '../lib/formatters'
import {
  getAutoModerationCategories,
  getAutoModerationSkipReasonKey,
  getAutoModerationState,
  getAutoModerationTone,
} from '../lib/reviewModeration'

const STATE_ICON = {
  blocked: ShieldAlert,
  skipped: CircleSlash,
  clean: ShieldCheck,
  unchecked: Bot,
}

const TONE_CLASS = {
  danger: 'border-danger-border bg-danger-bg text-danger',
  warning: 'border-warning-border bg-warning-bg text-warning',
  success: 'border-success-border bg-success-bg text-success',
  neutral: 'border-border bg-surface-muted text-muted-foreground',
}

// Badge dùng `variant`, không phải `tone` — map một lần ở đây để phần dưới chỉ nói bằng tone.
const TONE_BADGE_VARIANT = {
  danger: 'danger',
  warning: 'warning',
  success: 'muted',
  neutral: 'muted',
}

function categoryLabel(code, t) {
  return t(`reviews.moderation.category.${code}`, { defaultValue: t('common.unknown') })
}

function headline(review, state, t) {
  if (state === 'blocked') {
    return review.moderationSource === 'RULE'
      ? t('reviews.moderation.blockedByWord')
      : t('reviews.moderation.blockedByAi')
  }
  if (state === 'skipped') {
  return t(`reviews.moderation.skip.${getAutoModerationSkipReasonKey(review.moderationReason)}`, { defaultValue: t('common.unknown') })
  }
  if (state === 'clean') return t('reviews.moderation.clean')
  return t('reviews.moderation.unchecked')
}

/**
 * Kết quả kiểm duyệt tự động của một đánh giá (REVIEW_RULE_012).
 *
 * Dùng chung ở danh sách (`compact`) và chi tiết để hai nơi không bao giờ nói khác nhau
 * về cùng một đánh giá. Đây là ô ghi chú thuần hiển thị — mọi nút đổi trạng thái vẫn nằm
 * ở chỗ cũ, vì máy chỉ gợi ý còn người mới là bên quyết định.
 */
export function ReviewModerationNote({ review, compact = false }) {
  const { t } = useTranslation()
  const state = getAutoModerationState(review)
  const tone = getAutoModerationTone(state)
  const Icon = STATE_ICON[state] || Bot
  const categories = getAutoModerationCategories(review)
  const title = headline(review, state, t)

  if (compact) {
    // Danh sách chỉ cần biết "có cần để mắt không" — chi tiết đầy đủ ở trang chi tiết.
    if (state === 'unchecked') return <span className="text-muted-foreground">—</span>
    // "Sạch" là kết quả thường gặp nhất; tô xanh cả cột thì màn duyệt hàng loạt thành
    // rừng badge và cái thật sự cần chú ý (bị chặn / không lọc được) chìm mất. Trạng thái
    // này để mờ, chỉ hai trạng thái kia mới ăn màu.
    const compactTone = state === 'clean' ? 'neutral' : tone
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-sm border px-2 py-1 text-xs font-semibold ${TONE_CLASS[compactTone]}`}
        title={review.moderationReason || title}
      >
        <Icon size={14} aria-hidden="true" />
        {title}
      </span>
    )
  }

  return (
    <div className={`grid gap-3 rounded-md border p-4 ${TONE_CLASS[tone]}`}>
      <div className="flex items-start gap-2">
        <Icon size={18} aria-hidden="true" className="mt-1 shrink-0" />
        <div className="grid gap-1">
          <p className="m-0 font-semibold">{title}</p>
          {review.moderationReason && state !== 'skipped' ? (
            <p className="m-0 text-sm opacity-90">{review.moderationReason}</p>
          ) : null}
        </div>
      </div>

      {categories.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold opacity-80">{t('reviews.moderation.categoriesLabel')}</span>
          {categories.map((code) => (
            <Badge key={code} variant={TONE_BADGE_VARIANT[tone]}>{categoryLabel(code, t)}</Badge>
          ))}
        </div>
      ) : null}

      {state === 'clean' && categories.length ? (
        <p className="m-0 text-xs opacity-80">{t('reviews.moderation.notedButNotBlocked')}</p>
      ) : null}

      {state !== 'unchecked' ? (
        <p className="m-0 text-xs opacity-80">
          {t('reviews.moderation.checkedAt', { at: formatDateTime(review.moderationCheckedAt) })}
        </p>
      ) : null}

      <p className="m-0 text-xs opacity-80">{t('reviews.moderation.neverApprovesHint')}</p>
    </div>
  )
}
