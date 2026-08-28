import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { fetchMaintenance } from '../lib/adminApi'

function normalizeStatus(value) {
  const source = value?.data && typeof value.data === 'object' ? value.data : value
  if (!source || typeof source !== 'object') return null
  return {
    state: String(source.state || 'NORMAL').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'NORMAL',
    staffNote: source.staffNote || '',
    // Absent on the STOMP payload: the topic is broadcast, while canToggle is per-caller.
    // Keep it undefined there so the merge below can preserve the polled value.
    canToggle: source.canToggle,
  }
}

/**
 * Panel-wide maintenance notice.
 *
 * ACTIVE renders a blocking full-screen modal for everyone except the developer who owns the
 * lock. That is deliberate: the server already rejects their writes with 423, and one modal
 * here is far more reliable than threading a `disabled` flag through every screen. The
 * developer keeps a non-blocking banner so they can still reach the maintenance screen.
 *
 * Nothing here concerns customers — the storefront never enters maintenance.
 */
export function MaintenanceOverlay() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Polling is the recovery path for a dropped WebSocket; STOMP below is the fast path.
  const { data } = useQuery({
    queryKey: ['maintenance'],
    queryFn: fetchMaintenance,
    refetchInterval: 60_000,
    select: normalizeStatus,
  })

  useEffect(() => subscribeAdminWs('/topic/admin/maintenance', (event) => {
    const next = normalizeStatus(event)
    if (!next) return
    // Merge rather than replace: the broadcast carries no canToggle for this caller.
    queryClient.setQueryData(['maintenance'], (prev) => ({
      ...(prev || {}),
      state: next.state,
      staffNote: next.staffNote,
    }))
  }), [queryClient])

  if (!data || data.state !== 'ACTIVE') return null

  const canToggle = data.canToggle === true

  const details = (
    <div className="mt-4 rounded-[var(--admin-radius-control)] border border-border bg-muted p-3">
      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('maintenance.overlayStaffNote', { defaultValue: 'Lời nhắn cho nhân viên' })}
      </p>
      <p className="mb-0 mt-1 whitespace-pre-wrap text-sm text-foreground">
        {data.staffNote || t('maintenance.noStaffNote', { defaultValue: 'Chưa có lời nhắn.' })}
      </p>
    </div>
  )

  // Blocking modal: staff cannot save anything, so don't let them keep typing into a form
  // whose submit the server will refuse.
  if (!canToggle) {
    return (
      <div
        className="fixed inset-0 z-[var(--admin-z-overlay)] flex items-center justify-center bg-black/60 p-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="maintenance-overlay-title"
      >
        <div className="w-full max-w-lg rounded-[var(--admin-radius-card)] border border-border bg-card p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <Lock className="mt-1 shrink-0 text-primary" size={22} aria-hidden="true" />
            <div className="min-w-0 text-sm text-foreground">
              <p id="maintenance-overlay-title" className="m-0 text-base font-semibold">
                {t('maintenance.overlayActiveTitle', { defaultValue: 'Trang quản trị đang bảo trì' })}
              </p>
              <p className="mb-0 mt-2">
                {t('maintenance.overlayActiveBody', {
                  defaultValue: 'Mọi thay đổi tạm thời không lưu được. Nếu bạn vừa bấm lưu, thao tác đó CHƯA được ghi nhận — hãy làm lại sau khi mở khoá.',
                })}
              </p>
              <p className="mb-0 mt-2 text-muted-foreground">
                {t('maintenance.overlayCustomersSafe', {
                  defaultValue: 'Trang bán hàng vẫn chạy bình thường, khách vẫn đặt hàng được.',
                })}
              </p>
              {details}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-x-4 top-4 z-[var(--admin-z-overlay)] mx-auto max-w-3xl rounded-[var(--admin-radius-card)] border border-primary bg-card p-4 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Lock className="mt-1 shrink-0 text-primary" size={20} aria-hidden="true" />
        <div className="min-w-0 text-sm text-foreground">
          <p className="m-0 font-semibold">
            {t('maintenance.bannerActive', { defaultValue: 'Bạn đang khoá trang quản trị để bảo trì.' })}
          </p>
          {details}
        </div>
      </div>
    </div>
  )
}
