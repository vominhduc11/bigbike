import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { StatePanel } from '../components/StatePanel'
import { fetchProductAssignment, batchUpdateSettings } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { generateId } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { MIN_ASSIGNMENT_ROLES, MAX_ASSIGNMENT_ROLES } from './settings/constants'

function emptyRole() {
  return { id: generateId(), name: '', items: '' }
}

// `embedded` = nhúng trong 1 tab của màn Cài đặt — cùng convention với BannerScreen.
// Dùng react-query (queryKey ['product-assignment']) thay vì fetch thủ công như BannerScreen vì
// key này còn được ProductDetailScreen/ContentAssignmentBanner đọc cùng lúc: invalidateQueries
// sau khi lưu giúp banner ở tab sản phẩm/bài viết đang mở khác cập nhật ngay, không cần F5.
export function AssignmentRolesScreen({ canUpdate = false, embedded = false }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product-assignment'],
    queryFn: fetchProductAssignment,
  })

  const [title, setTitle] = useState('')
  const [roles, setRoles] = useState([])
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Nạp draft từ dữ liệu server MỘT LẦN khi tải xong (baseline chốt lại tại đây) — cập nhật state
  // ngay trong lúc render, đúng pattern React khuyến nghị cho "seed state từ giá trị bất đồng bộ
  // vừa có" (adjusting state when a prop changes) thay vì qua effect, tránh cascading re-render;
  // guard `!baseline` nên chỉ chạy đúng 1 lần, không ghi đè thao tác đang dở nếu query refetch nền
  // (vd tab khác vừa lưu xong).
  if (data && !baseline) {
    const seededRoles = data.roles?.length ? data.roles.map((r) => ({ ...r })) : [emptyRole()]
    setTitle(data.title || '')
    setRoles(seededRoles)
    setBaseline({ title: data.title || '', roles: seededRoles })
  }

  const isDirty = Boolean(
    baseline && (title !== baseline.title || JSON.stringify(roles) !== JSON.stringify(baseline.roles)),
  )

  useUnsavedChanges(isDirty)

  function updateRole(id, patch) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRole() {
    setRoles((prev) => [...prev, emptyRole()])
  }

  async function removeRole(id) {
    const role = roles.find((r) => r.id === id)
    const hasContent = Boolean(role?.name?.trim()) || Boolean(role?.items?.trim())
    if (hasContent) {
      const ok = await showConfirm(
        t('settings.assign.removeConfirmMessage', { defaultValue: 'Xóa vai trò này? Thay đổi chỉ áp dụng sau khi Lưu.' }),
        t('settings.assign.removeConfirmTitle', { defaultValue: 'Xóa vai trò' }),
      )
      if (!ok) return
    }
    setRoles((prev) => prev.filter((r) => r.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    setSaveSuccess(false)
    setSaveError('')
    try {
      const updates = []
      if (title !== baseline.title) updates.push({ key: 'product_assign_title', value: title })
      const rolesPayload = roles.map(({ id, name, items }) => ({ id, name, items }))
      if (JSON.stringify(roles) !== JSON.stringify(baseline.roles)) {
        updates.push({ key: 'product_assign_roles', value: JSON.stringify(rolesPayload) })
      }
      if (updates.length > 0) {
        await batchUpdateSettings(updates)
      }
      await queryClient.invalidateQueries({ queryKey: ['product-assignment'] })
      setBaseline({ title, roles: roles.map((r) => ({ ...r })) })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (e) {
      setSaveError(e.message || t('settings.assign.saveError', { defaultValue: 'Lưu thất bại.' }))
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !baseline) {
    return <StatePanel tone="info" title={t('settings.loading')} description={t('common.pleaseWait')} />
  }
  if (isError) {
    return (
      <StatePanel
        tone="danger"
        title={t('settings.loadError')}
        description={error?.message}
        actionLabel={t('common.retry')}
        onAction={() => refetch()}
      />
    )
  }

  const atMax = roles.length >= MAX_ASSIGNMENT_ROLES
  const atMin = roles.length <= MIN_ASSIGNMENT_ROLES

  return (
    <div>
      {embedded ? (
        <p className="bb-muted" style={{ marginTop: 0, marginBottom: 16 }}>
          {t('settings.assign.description', { defaultValue: 'Banner phân công hiển thị trên màn tạo/sửa sản phẩm và bài viết — dùng chung 1 nguồn dữ liệu.' })}
        </p>
      ) : (
        <div className="bb-screen-header">
          <div className="bb-screen-title">
            <h1>{t('settings.group_product_assign')}</h1>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 mb-4">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t('settings.assign.titleLabel', { defaultValue: 'Tiêu đề banner' })}
        </label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canUpdate} maxLength={1000} />
      </div>

      <div className="flex flex-col gap-3">
        {roles.map((role) => (
          <div key={role.id} className="bb-card flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                className="font-bold"
                placeholder={t('settings.assign.roleNamePlaceholder', { defaultValue: 'Tên vai trò' })}
                value={role.name}
                onChange={(e) => updateRole(role.id, { name: e.target.value })}
                disabled={!canUpdate}
                maxLength={1000}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                onClick={() => removeRole(role.id)}
                disabled={!canUpdate || atMin}
                aria-label={t('settings.assign.removeRole', { defaultValue: 'Xóa vai trò' })}
              >
                <Trash2 size={15} />
              </Button>
            </div>
            <Textarea
              placeholder={t('settings.assign.itemsPlaceholder', { defaultValue: 'Công việc phụ trách...' })}
              value={role.items}
              onChange={(e) => updateRole(role.id, { items: e.target.value })}
              disabled={!canUpdate}
              rows={2}
            />
          </div>
        ))}
        {canUpdate && (
          <Button variant="outline" size="sm" onClick={addRole} disabled={atMax} className="self-start">
            + {t('settings.assign.addRole', { defaultValue: 'Thêm vai trò' })}
          </Button>
        )}
      </div>

      {canUpdate && (isDirty || saveSuccess) && (
        <div
          className="bb-card"
          style={{
            position: 'sticky', bottom: 16, marginTop: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px',
          }}
        >
          <span
            className="bb-muted"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
              color: saveError ? 'var(--bb-danger)' : undefined,
            }}
            role={saveError ? 'alert' : undefined}
          >
            {saveError ? (
              <><AlertCircle size={14} style={{ color: 'var(--bb-danger)' }} /> {saveError}</>
            ) : saveSuccess ? (
              <><CheckCircle2 size={15} style={{ color: 'var(--bb-success)' }} /> {t('settings.saveSuccess')}</>
            ) : (
              <><AlertCircle size={14} /> {t('settings.assign.unsavedHint', { defaultValue: 'Có thay đổi chưa lưu' })}</>
            )}
          </span>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!isDirty}>
            {t('common.save')}
          </Button>
        </div>
      )}
    </div>
  )
}

export default AssignmentRolesScreen
