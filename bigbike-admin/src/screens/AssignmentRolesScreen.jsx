import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import { StatePanel } from '../components/StatePanel'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { StickyActionBar } from '../components/layout/StickyActionBar'
import { fetchProductAssignment, batchUpdateSettings } from '../lib/adminApi'
import { queryKeys } from '../lib/queryKeys'
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

// Một vai trò = một nhóm thu gọn (chống ngợp khi có tới 6 vai trò cùng lúc).
// Tên vai trò bắt buộc — hiện lỗi nội tuyến + dấu cảnh báo trên tiêu đề khi thiếu.
function RoleCard({ role, open, showError, canUpdate, atMin, onToggle, onUpdate, onRemove, onTouch, t }) {
  const nameError = showError && !role.name.trim()
    ? t('settings.assign.roleNameRequired', { defaultValue: 'Nhập tên vai trò' })
    : ''
  const displayTitle = role.name.trim() || t('settings.assign.roleUntitled', { defaultValue: 'Vai trò chưa đặt tên' })
  const nameId = `assignment-role-name-${role.id}`
  const itemsId = `assignment-role-items-${role.id}`
  return (
    <CollapsibleSection
      title={displayTitle}
      open={open}
      onToggle={onToggle}
      badge={nameError ? <AlertTriangle size={14} className="text-danger shrink-0 ml-1" aria-hidden /> : undefined}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <label className="sr-only" htmlFor={nameId}>
              {t('settings.assign.roleNameLabel')}
            </label>
            <Input
              id={nameId}
              className="font-bold"
              placeholder={t('settings.assign.roleNamePlaceholder', { defaultValue: 'Tên vai trò' })}
              value={role.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              onBlur={onTouch}
              disabled={!canUpdate}
              maxLength={1000}
              aria-invalid={nameError ? true : undefined}
            />
            {nameError && <span className="text-xs text-danger" role="alert">{nameError}</span>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
            onClick={onRemove}
            disabled={!canUpdate || atMin}
            aria-label={t('settings.assign.removeRole', { defaultValue: 'Xóa vai trò' })}
          >
            <Trash2 size={15} />
          </Button>
        </div>
        <label className="sr-only" htmlFor={itemsId}>
          {t('settings.assign.itemsLabel')}
        </label>
        <Textarea
          id={itemsId}
          placeholder={t('settings.assign.itemsPlaceholder', { defaultValue: 'Công việc phụ trách...' })}
          value={role.items}
          onChange={(e) => onUpdate({ items: e.target.value })}
          disabled={!canUpdate}
          rows={2}
        />
      </div>
    </CollapsibleSection>
  )
}

// `embedded` = nhúng trong 1 tab của màn Cài đặt — cùng convention với BannerScreen.
// Dùng react-query (queryKey ['product-assignment']) thay vì fetch thủ công như BannerScreen vì
// key này còn được ProductDetailScreen/ContentAssignmentBanner đọc cùng lúc: invalidateQueries
// sau khi lưu giúp banner ở tab sản phẩm/bài viết đang mở khác cập nhật ngay, không cần F5.
export function AssignmentRolesScreen({ canUpdate = false, embedded = false, onEditorStateChange }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.productAssignment(),
    queryFn: fetchProductAssignment,
  })

  const [title, setTitle] = useState('')
  const [roles, setRoles] = useState([])
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  // Trạng thái thu gọn từng vai trò (accordion opt-in) + validation nội tuyến.
  const [openRoleIds, setOpenRoleIds] = useState(() => new Set())
  const [touched, setTouched] = useState(() => new Set())
  const [attemptedSave, setAttemptedSave] = useState(false)

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
    // Mở sẵn vai trò đầu tiên, thu gọn phần còn lại để chống ngợp (chỉ chạy 1 lần cùng seed).
    setOpenRoleIds(new Set(seededRoles.length ? [seededRoles[0].id] : []))
  }

  const isDirty = Boolean(
    baseline && (title !== baseline.title || JSON.stringify(roles) !== JSON.stringify(baseline.roles)),
  )

  useEffect(() => {
    onEditorStateChange?.({
      dirtyCount: isDirty ? 1 : 0,
      saving,
      saveSuccess,
      error: saveError,
    })
  }, [isDirty, onEditorStateChange, saveError, saveSuccess, saving])

  useUnsavedChanges(isDirty)

  function updateRole(id, patch) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function toggleRole(id) {
    setOpenRoleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function markTouched(id) {
    setTouched((prev) => new Set(prev).add(id))
  }

  function addRole() {
    const role = emptyRole()
    setRoles((prev) => [...prev, role])
    setOpenRoleIds((prev) => new Set(prev).add(role.id))
  }

  function handleCancel() {
    if (!baseline) return
    setTitle(baseline.title)
    setRoles(baseline.roles.map((r) => ({ ...r })))
    setTouched(new Set())
    setAttemptedSave(false)
    setSaveError('')
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
    // Validation nội tuyến: mỗi vai trò phải có tên trước khi lưu.
    const invalidIds = roles.filter((r) => !r.name.trim()).map((r) => r.id)
    if (invalidIds.length > 0) {
      setAttemptedSave(true)
      setOpenRoleIds((prev) => new Set([...prev, ...invalidIds]))
      return
    }
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.productAssignment() })
      setBaseline({ title, roles: roles.map((r) => ({ ...r })) })
      setAttemptedSave(false)
      setTouched(new Set())
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (e) {
      setSaveError(e.message || t('settings.assign.saveError', { defaultValue: 'Lưu thất bại.' }))
    } finally {
      setSaving(false)
    }
  }

  // isError phải kiểm TRƯỚC guard loading: khi query lỗi thì data===undefined nên baseline mãi null,
  // nếu để `!baseline` chạy trước thì error state không bao giờ tới → kẹt "đang tải" vĩnh viễn.
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
  if (isLoading || !baseline) {
    return <StatePanel tone="info" title={t('settings.loading')} description={t('common.pleaseWait')} />
  }

  const atMax = roles.length >= MAX_ASSIGNMENT_ROLES
  const atMin = roles.length <= MIN_ASSIGNMENT_ROLES

  // Trạng thái thanh Lưu (tách khỏi JSX để tránh ternary lồng nhau).
  let statusInfo
  if (saveError) {
    statusInfo = (
      <span role="alert" className="inline-flex items-center gap-1.5 text-sm text-danger">
        <AlertCircle size={14} aria-hidden /> {saveError}
      </span>
    )
  } else if (saveSuccess) {
    statusInfo = (
      <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
        <CheckCircle2 size={15} aria-hidden /> {t('settings.saveSuccess')}
      </span>
    )
  } else {
    statusInfo = (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <AlertCircle size={14} aria-hidden /> {t('settings.assign.unsavedHint', { defaultValue: 'Có thay đổi chưa lưu' })}
      </span>
    )
  }

  return (
    <div>
      {embedded ? (
        <p className="bb-muted mt-0 mb-4">
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
        <label
          htmlFor="assignment-banner-title"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          {t('settings.assign.titleLabel', { defaultValue: 'Tiêu đề banner' })}
        </label>
        <Input
          id="assignment-banner-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!canUpdate}
          maxLength={1000}
        />
      </div>

      <div className="flex flex-col gap-3">
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            open={openRoleIds.has(role.id)}
            showError={attemptedSave || touched.has(role.id)}
            canUpdate={canUpdate}
            atMin={atMin}
            onToggle={() => toggleRole(role.id)}
            onUpdate={(patch) => updateRole(role.id, patch)}
            onRemove={() => removeRole(role.id)}
            onTouch={() => markTouched(role.id)}
            t={t}
          />
        ))}
        {canUpdate && (
          <Button variant="outline" size="sm" onClick={addRole} disabled={atMax} className="self-start">
            + {t('settings.assign.addRole', { defaultValue: 'Thêm vai trò' })}
          </Button>
        )}
      </div>

      {canUpdate && (isDirty || saveSuccess) && (
        <StickyActionBar ariaLabel={t('common.actionBarLabel')} info={statusInfo}>
          <Button className="min-h-11" variant="secondary" onClick={handleCancel} disabled={saving || !isDirty}>
            {t('common.cancel')}
          </Button>
          <Button className="min-h-11" onClick={handleSave} loading={saving} disabled={!isDirty}>
            {t('common.save')}
          </Button>
        </StickyActionBar>
      )}
    </div>
  )
}

export default AssignmentRolesScreen
