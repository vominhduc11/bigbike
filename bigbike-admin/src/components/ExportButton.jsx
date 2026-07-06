import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'

/**
 * Nút xuất tệp dùng chung (N6) — tự quản trạng thái đang-chạy.
 *
 * Trong lúc `onExport` (async) chạy: nút disable + đổi icon sang spinner + aria-busy,
 * tránh bấm nhiều lần và cho người dùng biết đang xử lý. Lỗi -> toast.
 * Giữ style bb-btn để đồng bộ với các nút hành động khác trong header.
 *
 * @param {{ onExport: () => Promise<any>, children: any, className?: string, icon?: boolean, title?: string, disabled?: boolean }} props
 */
export function ExportButton({ onExport, children, className = 'bb-btn bb-btn-secondary', icon = true, title, disabled = false }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (busy || disabled) return
    setBusy(true)
    try {
      await onExport()
    } catch (e) {
      toast.error(e?.message || 'Xuất tệp thất bại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className={className} onClick={handleClick} disabled={busy || disabled} aria-busy={busy || undefined} title={title}>
      {busy
        ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        : (icon ? <Download size={14} aria-hidden="true" /> : null)}
      {busy ? t('export.exporting') : children}
    </button>
  )
}
