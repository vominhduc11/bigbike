import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useImageDimensions, useVideoDimensions } from '@/lib/useMediaDimensions'
import { evaluateImageDimensions } from '@/lib/imageRecommendations'

// Cảnh báo khi ảnh/video admin chọn không đạt kích thước/tỉ lệ khuyến nghị của
// vị trí hiển thị. Tự đo kích thước thật rồi so với spec. KHÔNG chặn — chỉ nhắc.
// Đạt chuẩn hoặc đang tải → không hiển thị gì.
export function MediaDimensionWarning({ url, recommend, kind = 'image', className }) {
  const { t } = useTranslation()
  const imageDims = useImageDimensions(kind === 'image' ? url : '')
  const videoDims = useVideoDimensions(kind === 'video' ? url : '')
  const { status, width, height } = kind === 'video' ? videoDims : imageDims

  if (!recommend || status !== 'loaded') return null
  const reasons = evaluateImageDimensions(width, height, recommend)
  if (!reasons) return null

  const isVideo = kind === 'video'
  const messages = reasons.map((reason) => {
    const key = reason === 'tooSmall'
      ? (isVideo ? 'mediaReco.videoTooSmall' : 'mediaReco.tooSmall')
      : (isVideo ? 'mediaReco.videoWrongRatio' : 'mediaReco.wrongRatio')
    return t(key, { w: width, h: height, rw: recommend.idealW, rh: recommend.idealH })
  })

  return (
    <div
      className={cn(
        'mt-2 flex items-start gap-2 px-2.5 py-2 text-xs rounded-[var(--admin-radius-sm)] bg-[var(--admin-color-status-warning-bg)] border border-[var(--admin-color-status-warning-border)] text-[var(--admin-color-status-warning-text)]',
        className,
      )}
      role="status"
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{messages.join(' ')}</span>
    </div>
  )
}
