import { useTranslation } from 'react-i18next'
import { X as XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Upload queue panel — floating progress list for in-flight media uploads.
// Behaviour identical to the inline component it replaced; state lives in the
// parent and is threaded via the `queue` prop + `onDismiss` callback.
export function UploadQueue({ queue, onDismiss }) {
  const { t } = useTranslation()
  const pending = queue.filter((u) => u.status === 'uploading' || u.status === 'pending').length
  return (
    <div className="fixed bottom-4 right-4 z-[var(--admin-z-toast)] bg-surface border border-border rounded-md shadow-xl w-[360px] max-w-[calc(100vw-2rem)] max-h-[360px] overflow-y-auto">
      <div className="px-3 py-2 border-b border-border font-bold text-sm">
        {pending > 0
          ? t('media.uploading') + ` (${pending})`
          : t('media.uploadComplete', { count: queue.length })}
      </div>
      {queue.map((u) => {
        // Chặn đóng khi tệp còn đang xếp hàng / đang tải: đóng lúc này sẽ mất theo dõi
        // tiến độ và khiến admin tưởng đã huỷ được (thực tế tải vẫn chạy nền).
        const inFlight = u.status === 'pending' || u.status === 'uploading'
        return (
          <div key={u.id} className="px-3 py-2 border-b border-border text-xs">
            <div className="flex justify-between items-center gap-2">
              <span className="truncate flex-1" title={u.name}>
                {u.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onDismiss(u.id)}
                disabled={inFlight}
                aria-label={t('notifications.close')}
                title={
                  inFlight
                    ? t('media.dismissWhileUploading', {
                        defaultValue: 'Đang tải lên, chưa thể đóng',
                      })
                    : undefined
                }
                className="!h-5 !w-5 !p-1 bg-transparent border-none text-muted-foreground"
              >
                <XIcon size={12} />
              </Button>
            </div>
            {u.status === 'error' ? (
              <p className="text-danger mt-1 mb-0 text-xs">{u.error}</p>
            ) : (
              <progress
                className={cn(
                  'mt-1 h-1 w-full',
                  u.status === 'done' ? 'accent-success' : 'accent-primary',
                )}
                value={Math.round(u.progress ?? 0)}
                max={100}
                aria-label={t('media.uploadProgress', {
                  name: u.name,
                  defaultValue: 'Tiến độ tải lên {{name}}',
                })}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
