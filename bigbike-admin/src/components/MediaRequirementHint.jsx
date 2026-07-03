import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Dòng yêu cầu kích thước/tỉ lệ — hiển thị THƯỜNG TRỰC tại ô upload (kể cả chưa chọn ảnh)
// để admin biết trước cần chuẩn bị ảnh cỡ nào. Khác MediaDimensionWarning (đã gỡ bỏ, chỉ nhắc
// sau khi chọn): đây chỉ là gợi ý tĩnh, việc CHẶN thật do useMediaValidation() đảm nhiệm.
export function MediaRequirementHint({ recommend, className }) {
  const { t } = useTranslation()
  if (!recommend) return null
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      {t('mediaReco.requirementSize', { w: recommend.minW, h: recommend.minH })}
      {recommend.ratio && t('mediaReco.requirementRatio', { rw: recommend.ratio[0], rh: recommend.ratio[1] })}
    </p>
  )
}

// Dòng lỗi CHẶN LƯU khi ảnh/video đã chọn không đạt spec — hiển thị đè lên hint tĩnh ở trên.
export function MediaValidationError({ reasons, kind, width, height, recommend, className }) {
  const { t } = useTranslation()
  if (!reasons?.length) return null
  const isVideo = kind === 'video'
  const messages = reasons.map((reason) => {
    const key = reason === 'tooSmall'
      ? (isVideo ? 'mediaReco.videoTooSmall' : 'mediaReco.tooSmall')
      : (isVideo ? 'mediaReco.videoWrongRatio' : 'mediaReco.wrongRatio')
    return t(key, { w: width, h: height, rw: recommend.minW, rh: recommend.minH })
  })
  return (
    <div
      className={cn(
        'mt-2 flex items-start gap-2 px-2.5 py-2 text-xs rounded-[var(--admin-radius-sm)] bg-[var(--admin-color-status-danger-bg)] border border-[var(--admin-color-status-danger-border)] text-[var(--admin-color-status-danger-text)]',
        className,
      )}
      role="alert"
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{messages.join(' ')}</span>
    </div>
  )
}
