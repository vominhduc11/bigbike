import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'

/**
 * Nút xuất tệp dùng chung (N6) — tự quản trạng thái đang-chạy.
 *
 * Trong lúc `onExport` (async) chạy: nút disable + đổi icon sang spinner + aria-busy,
 * tránh bấm nhiều lần và cho người dùng biết đang xử lý. Lỗi -> toast.
 * Dùng shadcn Button (variant "secondary" mặc định) để đồng bộ với các nút khác.
 *
 * @param {{ onExport: () => Promise<any>, children: any, variant?: string, className?: string, icon?: boolean, title?: string, disabled?: boolean }} props
 */
export function ExportButton({ onExport, children, variant = 'secondary', className, icon = true, title, disabled = false }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (busy || disabled) return
    setBusy(true)
    try {
      await onExport()
    } catch (e) {
      toast.error(e?.message || t('export.error', { defaultValue: 'Xuất tệp thất bại.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button type="button" variant={variant} className={className} onClick={handleClick} disabled={busy || disabled} aria-busy={busy || undefined} title={title}>
      {busy
        ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        : (icon ? <Download size={14} aria-hidden="true" /> : null)}
      {busy ? t('export.exporting') : children}
    </Button>
  )
}
