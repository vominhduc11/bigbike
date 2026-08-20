import { useTranslation } from 'react-i18next'

// Suspense fallback dùng chung khi tải chunk của một screen lazy.
// Khớp khung layout chung (tiêu đề + thanh lọc + bảng) để tránh giật bố cục
// so với một panel "đang tải" căn giữa.
export function ScreenSkeleton({ variant = 'screen', inlineOnly = false }) {
  const { t } = useTranslation()
  if (variant === 'editor') {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">{t('common.loading')}</span>
        <div className="animate-pulse overflow-hidden rounded-md border-[1.5px] border-border" aria-hidden="true">
          <div className="flex h-11 items-center gap-2 border-b border-border bg-surface-muted px-2.5">
            <div className="h-8 w-8 rounded-xs bg-surface" />
            <div className="h-8 w-8 rounded-xs bg-surface" />
            <div className="h-8 w-8 rounded-xs bg-surface" />
            <div className="h-5 w-px bg-border" />
            <div className="h-8 w-8 rounded-xs bg-surface" />
          </div>
          <div className={`${inlineOnly ? 'min-h-32' : 'min-h-60'} bg-surface p-4`}>
            <div className="h-4 w-3/4 rounded-xs bg-surface-muted" />
            <div className="mt-3 h-4 w-1/2 rounded-xs bg-surface-muted" />
          </div>
        </div>
      </div>
    )
  }
  return (
    // role=status + text sr-only để trình đọc màn hình biết đang tải; khung skeleton bên dưới
    // thuần trang trí nên vẫn aria-hidden.
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="animate-pulse" aria-hidden="true">
      <div className="mb-5 flex flex-col gap-2">
        <div className="h-3 w-24 rounded-xs bg-surface-muted" />
        <div className="h-7 w-64 rounded-xs bg-surface-muted" />
        <div className="h-3 w-80 max-w-full rounded-xs bg-surface-muted" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="h-9 w-56 rounded-sm bg-surface-muted" />
        <div className="h-9 w-32 rounded-sm bg-surface-muted" />
        <div className="h-9 w-32 rounded-sm bg-surface-muted" />
      </div>
      <div className="rounded-sm border border-border">
        <div className="h-10 border-b border-border bg-surface-muted/60" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <div className="h-4 flex-1 rounded-xs bg-surface-muted" />
            <div className="h-4 w-24 rounded-xs bg-surface-muted" />
            <div className="h-4 w-16 rounded-xs bg-surface-muted" />
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}
