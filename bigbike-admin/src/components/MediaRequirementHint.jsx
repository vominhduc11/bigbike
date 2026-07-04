import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Dòng khuyến nghị kích thước/tỉ lệ — hiển thị THƯỜNG TRỰC tại ô upload (kể cả chưa chọn ảnh)
// để admin biết trước nên chuẩn bị ảnh cỡ nào. Kích thước chỉ là GỢI Ý (không chặn lưu); tỉ lệ
// mới là điều kiện CHẶN LƯU thật sự, do useMediaValidation() đảm nhiệm (xem MediaValidationError).
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

// Dòng lỗi CHẶN LƯU khi ảnh/video đã chọn sai tỉ lệ — hiển thị đè lên hint tĩnh ở trên.
// Kích thước không còn là lý do chặn nên `reasons` giờ chỉ có thể chứa 'wrongRatio'.
export function MediaValidationError({ reasons, kind, width, height, recommend, className }) {
  const { t } = useTranslation()
  if (!reasons?.length) return null
  const isVideo = kind === 'video'
  const messages = reasons.map((_reason) => {
    const key = isVideo ? 'mediaReco.videoWrongRatio' : 'mediaReco.wrongRatio'
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
