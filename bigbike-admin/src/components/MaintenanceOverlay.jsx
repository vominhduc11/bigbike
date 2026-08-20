import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, Lock } from 'lucide-react'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { fetchMaintenance } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'

function normalizeStatus(value) {
  const source = value?.data && typeof value.data === 'object' ? value.data : value
  if (!source || typeof source !== 'object') return null
  return {
    state: String(source.state || 'NORMAL').toUpperCase(),
    staffNote: source.staffNote || '',
    expectedAt: source.expectedAt || null,
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

  useEffect(
    () =>
      subscribeAdminWs('/topic/admin/maintenance', (event) => {
        const next = normalizeStatus(event)
        if (!next) return
        // Merge rather than replace: the broadcast carries no canToggle for this caller.
        queryClient.setQueryData(['maintenance'], (prev) => ({
          ...(prev || {}),
          state: next.state,
          staffNote: next.staffNote,
          expectedAt: next.expectedAt,
        }))
      }),
    [queryClient],
  )

  if (!data || !['UPCOMING', 'ACTIVE'].includes(data.state)) return null

  const isActive = data.state === 'ACTIVE'
  const canToggle = data.canToggle === true
  const expected = data.expectedAt ? formatDateTime(data.expectedAt) : ''

  const details = (
    <>
      {data.staffNote ? <p className="mb-0 mt-2">{data.staffNote}</p> : null}
      {expected ? (
        <p className="mb-0 mt-2 text-muted-foreground">
          {t('maintenance.expectedAt', { defaultValue: 'Dự kiến xong lúc' })}: {expected}
        </p>
      ) : null}
    </>
  )

  // Blocking modal: staff cannot save anything, so don't let them keep typing into a form
  // whose submit the server will refuse.
  if (isActive && !canToggle) {
    return (
      <div
        className="fixed inset-0 z-[var(--admin-z-overlay)] flex items-center justify-center bg-black/60 p-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="maintenance-overlay-title"
      >
        <div className="w-full max-w-lg rounded-[var(--admin-radius-card)] border border-border bg-card p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 shrink-0 text-primary" size={22} aria-hidden="true" />
            <div className="min-w-0 text-sm text-foreground">
              <p id="maintenance-overlay-title" className="m-0 text-base font-semibold">
                {t('maintenance.overlayActiveTitle', {
                  defaultValue: 'Trang quản trị đang bảo trì',
                })}
              </p>
              <p className="mb-0 mt-2">
                {t('maintenance.overlayActiveBody', {
                  defaultValue:
                    'Mọi thay đổi tạm thời không lưu được. Nếu bạn vừa bấm lưu, thao tác đó CHƯA được ghi nhận — hãy làm lại sau khi mở khoá.',
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
        {isActive ? (
          <Lock className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden="true" />
        ) : (
          <Clock3 className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden="true" />
        )}
        <div className="min-w-0 text-sm text-foreground">
          <p className="m-0 font-semibold">
            {isActive
              ? t('maintenance.bannerActive', {
                  defaultValue: 'Bạn đang khoá trang quản trị để bảo trì.',
                })
              : t('maintenance.bannerUpcoming', { defaultValue: 'Trang quản trị sắp bảo trì.' })}
          </p>
          {!isActive ? (
            <p className="mb-0 mt-1">
              {t('maintenance.bannerUpcomingHint', {
                defaultValue:
                  'Hãy lưu lại các thay đổi đang làm dở. Hiện tại bạn vẫn lưu được bình thường.',
              })}
            </p>
          ) : null}
          {details}
        </div>
      </div>
    </div>
  )
}
