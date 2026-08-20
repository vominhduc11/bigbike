import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, Lock, ShieldCheck } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from '../components/SectionCard'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { FormField } from '../components/layout/FormField'
import { showConfirm } from '../lib/confirm'
import { fetchMaintenance, updateMaintenance } from '../lib/adminApi'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { formatDateTime } from '../lib/formatters'

const STATES = { NORMAL: 'NORMAL', UPCOMING: 'UPCOMING', ACTIVE: 'ACTIVE' }

/** `datetime-local` needs a local `YYYY-MM-DDTHH:mm`; the API speaks ISO-8601 instants. */
function toLocalInput(iso) {
  if (!iso) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  const offset = parsed.getTimezoneOffset() * 60_000
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16)
}

function toIso(localValue) {
  if (!localValue) return null
  const parsed = new Date(localValue)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/**
 * Dev-only control for the admin-panel maintenance lock.
 *
 * Reachable only by the DEVELOPER role — App.jsx hides the nav entry and route, and the
 * server rejects the write regardless (see AdminMaintenanceController). The storefront is
 * never affected by anything on this screen: customers keep ordering throughout
 * (BUSINESS_RULES `MAINTENANCE_RULE_002`).
 */
export function MaintenanceScreen() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // `null` means "not edited yet" so the server value shows through without an effect that
  // copies data into state (which would fight whatever the developer is currently typing).
  const [noteDraft, setNoteDraft] = useState(null)
  const [expectedDraft, setExpectedDraft] = useState(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['maintenance'],
    queryFn: fetchMaintenance,
  })

  // Another developer may flip the state from their own session; the same STOMP topic the
  // overlay listens on keeps this screen honest without a manual reload.
  useEffect(
    () =>
      subscribeAdminWs('/topic/admin/maintenance', () => {
        queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      }),
    [queryClient],
  )

  const staffNote = noteDraft ?? (data?.staffNote || '')
  const expectedAt = expectedDraft ?? toLocalInput(data?.expectedAt)

  const mutation = useMutation({
    mutationFn: (state) => updateMaintenance({ state, staffNote, expectedAt: toIso(expectedAt) }),
    onSuccess: (result) => {
      setNoteDraft(null)
      setExpectedDraft(null)
      queryClient.setQueryData(['maintenance'], result)
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      toast.success(t('maintenance.saved', { defaultValue: 'Đã cập nhật trạng thái bảo trì.' }))
    },
    onError: (error) => toast.error(error?.message || t('common.saveFailed')),
  })

  const state = data?.state || STATES.NORMAL
  const canToggle = data?.canToggle === true
  const uploadCount = data?.uploadCount || 0
  const busy = mutation.isPending

  const tone = useMemo(() => {
    if (state === STATES.ACTIVE)
      return {
        label: t('maintenance.stateActive', { defaultValue: 'Đang khoá' }),
        badge: 'bb-badge-danger',
        Icon: Lock,
      }
    if (state === STATES.UPCOMING)
      return {
        label: t('maintenance.stateUpcoming', { defaultValue: 'Sắp bảo trì' }),
        badge: 'bb-badge-warning',
        Icon: Clock3,
      }
    return {
      label: t('maintenance.stateNormal', { defaultValue: 'Bình thường' }),
      badge: 'bb-badge-success',
      Icon: ShieldCheck,
    }
  }, [state, t])

  async function apply(next) {
    if (next === STATES.ACTIVE) {
      const uploadWarning =
        uploadCount > 0
          ? t('maintenance.confirmLockUploads', {
              count: uploadCount,
              defaultValue: `Đang có ${uploadCount} tệp tải lên dở dang — khoá bây giờ sẽ làm hỏng các tệp đó. `,
            })
          : ''
      const ok = await showConfirm(
        `${uploadWarning}${t('maintenance.confirmLockBody', {
          defaultValue:
            'Nhân viên sẽ không lưu được bất kỳ thay đổi nào cho tới khi bạn mở lại. Khách hàng không bị ảnh hưởng.',
        })}`,
        t('maintenance.confirmLockTitle', { defaultValue: 'Khoá trang quản trị?' }),
        {
          variant: 'danger',
          confirmLabel: t('maintenance.lockNow', { defaultValue: 'Khoá ngay' }),
        },
      )
      if (!ok) return
    }
    mutation.mutate(next)
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  if (isError) {
    return (
      <Alert tone="danger">
        {t('common.loadFailed')}{' '}
        <Button variant="link" onClick={() => refetch()}>
          {t('common.retry')}
        </Button>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {!canToggle && (
        <ReadOnlyBanner
          warning={t('maintenance.developerOnly', {
            defaultValue: 'Chỉ tài khoản kỹ thuật (DEVELOPER) mới bật/tắt được chế độ bảo trì.',
          })}
        />
      )}

      <SectionCard
        title={t('maintenance.title', { defaultValue: 'Chế độ bảo trì trang quản trị' })}
        badge={
          <span className={`bb-badge ${tone.badge}`}>
            <tone.Icon size={14} aria-hidden="true" /> {tone.label}
          </span>
        }
      >
        <p className="mt-0 text-sm text-muted-foreground">
          {t('maintenance.intro', {
            defaultValue:
              'Khoá chỉ áp dụng cho trang quản trị. Trang bán hàng và việc đặt hàng của khách không bị ảnh hưởng ở bất kỳ trạng thái nào.',
          })}
        </p>

        {state === STATES.ACTIVE && (
          <Alert tone="danger" className="mt-3">
            {t('maintenance.activeHint', {
              defaultValue:
                'Nhân viên đang không lưu được thay đổi nào. Chỉ tài khoản kỹ thuật còn thao tác được.',
            })}
          </Alert>
        )}

        {uploadCount > 0 && (
          <Alert tone="warning" className="mt-3">
            {t('maintenance.uploadsInFlight', {
              count: uploadCount,
              defaultValue: `Đang có ${uploadCount} tệp tải lên dở dang.`,
            })}
          </Alert>
        )}

        {data?.updatedAt && (
          <p className="mb-0 mt-3 text-xs text-muted-foreground">
            {t('maintenance.updatedAt', { defaultValue: 'Cập nhật lần cuối' })}:{' '}
            {formatDateTime(data.updatedAt)}
          </p>
        )}
      </SectionCard>

      <SectionCard
        title={t('maintenance.detailsTitle', { defaultValue: 'Thông tin hiển thị cho nhân viên' })}
      >
        <div className="flex flex-col gap-4">
          <FormField
            label={t('maintenance.staffNote', { defaultValue: 'Lời nhắn cho nhân viên' })}
            helper={t('maintenance.staffNoteHint', {
              defaultValue: 'Hiện trên thông báo bảo trì của mọi nhân viên đang đăng nhập.',
            })}
          >
            <Textarea
              rows={3}
              maxLength={2000}
              value={staffNote}
              disabled={!canToggle || busy}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder={t('maintenance.staffNotePlaceholder', {
                defaultValue: 'Ví dụ: Đang nâng cấp dữ liệu sản phẩm, dự kiến xong 15:00.',
              })}
            />
          </FormField>

          <FormField
            label={t('maintenance.expectedAt', { defaultValue: 'Dự kiến xong lúc' })}
            helper={t('maintenance.expectedAtHint', {
              defaultValue: 'Chỉ để hiển thị — hệ thống không tự khoá hay tự mở theo mốc này.',
            })}
          >
            <Input
              type="datetime-local"
              value={expectedAt}
              disabled={!canToggle || busy}
              onChange={(event) => setExpectedDraft(event.target.value)}
            />
          </FormField>
        </div>
      </SectionCard>

      {canToggle && (
        <div className="sticky-action-bar flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={busy || state === STATES.UPCOMING}
            onClick={() => apply(STATES.UPCOMING)}
          >
            <Clock3 size={16} aria-hidden="true" />
            {t('maintenance.warnStaff', { defaultValue: 'Báo trước cho nhân viên' })}
          </Button>
          <Button
            variant="danger"
            disabled={busy || state === STATES.ACTIVE}
            onClick={() => apply(STATES.ACTIVE)}
          >
            <Lock size={16} aria-hidden="true" />
            {t('maintenance.lockNow', { defaultValue: 'Khoá ngay' })}
          </Button>
          <Button
            variant="default"
            disabled={busy || state === STATES.NORMAL}
            onClick={() => apply(STATES.NORMAL)}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {t('maintenance.unlock', { defaultValue: 'Mở lại' })}
          </Button>
        </div>
      )}
    </div>
  )
}
