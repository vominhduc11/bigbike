import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { AlertCircle, CheckCircle2, Lock, Mail, Pencil, UserCheck, UserPlus } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { AdminTable } from '../components/AdminTable'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { FilterChips } from '../components/FilterChips'
import { FormField } from '../components/layout/FormField'
import { Modal, ScreenHeader } from '../components/layout'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createAdminUser, fetchAdminUsers, fetchRoles, resendAdminInvite, updateAdminUser, mapValidationErrors } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { showConfirm } from '../lib/confirm'
import { toast } from '@/lib/toast'
import { useDebounce } from '../lib/useDebounce'
import { readPageSizePreference } from '../lib/pageSizePreference'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { readDraft, useDraftAutosave } from '../lib/useDraftAutosave'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '../components/PasswordInput'
import { getRoleDisplayName } from './roles/constants'

const INITIAL_QUERY = { search: '', page: 1, pageSize: 20, role: '', status: '' }

// Đủ để bắt lỗi nhập sai phổ biến phía client; backend vẫn là nguồn xác thực cuối.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN_LENGTH = 8

const STATUS_META = {
  INVITED:   { labelKey: 'adminUsers.statusInvited', tone: 'info' },
  ACTIVE:    { labelKey: 'adminUsers.statusActive', tone: 'success' },
  DISABLED:  { labelKey: 'adminUsers.statusDisabled', tone: 'danger' },
  SUSPENDED: { labelKey: 'adminUsers.statusSuspended', tone: 'warning' },
}
const MANUALLY_EDITABLE_STATUSES = ['ACTIVE', 'DISABLED', 'SUSPENDED']

function adminUserEditDraftKey(userId) {
  return userId ? `draft:admin-user-edit:${userId}` : 'draft:admin-user-edit:none'
}

const ADMIN_USER_CREATE_DRAFT_KEY = 'draft:admin-user-create'

// Role → bb-badge palette.
const ROLE_BADGE = {
  SUPER_ADMIN: 'bb-badge-danger',
  ADMIN: 'bb-badge-info',
  SHOP_MANAGER: 'bb-badge-info',
  EDITOR: 'bb-badge-neutral',
}
const AVATAR_COLORS = [
  'bg-primary text-primary-foreground',
  'bg-info-bg text-info',
  'bg-success-bg text-success',
  'bg-warning-bg text-warning',
  'bg-danger-bg text-danger',
  'bg-secondary text-secondary-foreground',
]

function avatarColorFor(user) {
  const stableKey = String(user?.id || user?.email || user?.displayName || '')
  let hash = 0
  for (let i = 0; i < stableKey.length; i += 1) {
    hash = ((hash * 31) + stableKey.charCodeAt(i)) | 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const ADMIN_USER_BACKEND_ERROR_TRANSLATIONS = {
  'Only a SUPER_ADMIN can modify a SUPER_ADMIN account': {
    key: 'adminUsers.errSuperAdminModify',
    defaultValue: 'Chỉ Chủ hệ thống mới sửa được tài khoản Chủ hệ thống khác.',
  },
  'Only a SUPER_ADMIN can grant the SUPER_ADMIN role': {
    key: 'adminUsers.errSuperAdminGrant',
    defaultValue: 'Chỉ Chủ hệ thống mới có thể cấp vai trò Chủ hệ thống.',
  },
  'Cannot disable the last active SUPER_ADMIN': {
    key: 'adminUsers.errLastSuperAdminDisable',
    defaultValue: 'Không thể vô hiệu hoá Chủ hệ thống cuối cùng đang hoạt động.',
  },
  'SUPER_ADMIN cannot demote themselves': {
    key: 'adminUsers.errSelfDemote',
    defaultValue: 'Chủ hệ thống không thể tự hạ quyền của chính mình.',
  },
  'Cannot demote the last active SUPER_ADMIN': {
    key: 'adminUsers.errLastSuperAdminDemote',
    defaultValue: 'Không thể hạ quyền Chủ hệ thống cuối cùng đang hoạt động.',
  },
  'Admin cannot deactivate their own account': {
    key: 'adminUsers.errSelfDeactivate',
    defaultValue: 'Bạn không thể tự khóa tài khoản đang đăng nhập.',
  },
  'INVITED accounts must accept their invite before becoming active': {
    key: 'adminUsers.errInviteMustBeAccepted',
    defaultValue: 'Tài khoản chờ kích hoạt phải dùng liên kết mời để đặt mật khẩu và kích hoạt.',
  },
}

function getAdminUserErrorMessage(error, t) {
  const message = typeof error?.message === 'string' ? error.message.trim() : ''
  const translation = ADMIN_USER_BACKEND_ERROR_TRANSLATIONS[message.replace(/\.$/, '')]
  return translation
    ? t(translation.key, { defaultValue: translation.defaultValue })
    : message || t('common.error')
}

function RoleBadge({ role, label }) {
  return <span className={`bb-badge ${ROLE_BADGE[role] || 'bb-badge-neutral'}`}>{label || '—'}</span>
}

function UserStatusBadge({ status, t }) {
  const meta = STATUS_META[status]
  const label = meta ? t(meta.labelKey) : status
  return (
    <span className={`bb-badge bb-badge-${meta?.tone || 'neutral'}`}>
      <span className="dot" />{label || '—'}
    </span>
  )
}

function PasswordField({ value, onChange, onBlur, placeholder, label, hint, error, disabled }) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  return (
    <label className="au-field">
      <span className="au-field-label">{label}</span>
      <PasswordInput
        id={inputId}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="new-password"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <span id={errorId} className="flex items-center gap-1 text-xs text-danger" role="alert">
          <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
          {error}
        </span>
      ) : hint ? (
        <span className="au-field-hint">{hint}</span>
      ) : null}
    </label>
  )
}

export function AdminUsersScreen({
  canUpdate,
  canReadRoles = true,
  canAssignRoles = true,
  currentUserId,
  isSuperAdmin,
}) {
  const { t } = useTranslation()

  // ── List state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState(() => ({
    ...INITIAL_QUERY,
    pageSize: readPageSizePreference(INITIAL_QUERY.pageSize),
  }))
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  const [listState, setListState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  // Sắp xếp phía client (endpoint admin users không hỗ trợ sort server-side).
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  // ── Canonical role catalog ──────────────────────────────────────────────
  const [roles, setRoles] = useState([])
  const [rolesError, setRolesError] = useState(false)
  useEffect(() => {
    if (!canReadRoles) {
      return undefined
    }
    // Lỗi tải danh sách vai trò không còn bị nuốt: hiện cảnh báo để admin
    // biết danh sách vai trò có thể chưa đầy đủ (thay vì lặng lẽ thiếu lựa chọn).
    fetchRoles()
      .then((r) => { setRoles(r.items || []); setRolesError(false) })
      .catch(() => setRolesError(true))
  }, [canReadRoles])

  const roleOptions = useMemo(() => {
    return roles.map((role) => role.id).filter(Boolean)
  }, [roles])

  const rolesById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles])
  const defaultRole = useMemo(
    () => roleOptions.includes('ADMIN') ? 'ADMIN' : (roleOptions[0] || ''),
    [roleOptions],
  )
  const canChangeRoles = canAssignRoles && roleOptions.length > 0

  const createRoleOptions = useMemo(
    () => (isSuperAdmin ? roleOptions : roleOptions.filter((role) => role !== 'SUPER_ADMIN')),
    [isSuperAdmin, roleOptions],
  )
  const editRoleOptions = useMemo(
    () => (isSuperAdmin ? roleOptions : roleOptions.filter((role) => role !== 'SUPER_ADMIN')),
    [isSuperAdmin, roleOptions],
  )

  // Đổi mã vai trò sang nhãn bằng đúng helper mà màn Phân quyền sử dụng.
  const resolveRoleLabel = useCallback((roleId) => {
    if (!roleId) return '—'
    const role = rolesById.get(roleId)
    return role ? getRoleDisplayName(role, t) : roleId
  }, [rolesById, t])

  // Chặn double-submit của nút kích hoạt/khoá ngay trên dòng: khoá nút đang xử lý.
  const [togglingId, setTogglingId] = useState(null)
  const [resendingId, setResendingId] = useState(null)

  // ── Edit drawer state ───────────────────────────────────────────────────
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [editFieldErrors, setEditFieldErrors] = useState({})
  const [editSuccess, setEditSuccess] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  // ── Create modal state ──────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', displayName: '', role: 'ADMIN' })
  const [createError, setCreateError] = useState('')
  const [createFieldErrors, setCreateFieldErrors] = useState({})
  const [createSaving, setCreateSaving] = useState(false)
  // After an invite is created/resent: { email, inviteUrl, emailSent } — shown as a banner.
  const [inviteInfo, setInviteInfo] = useState(null)

  // Chỉ lưu các trường có thể khôi phục an toàn. Tuyệt đối không lưu mật khẩu
  // mới, token, liên kết mời hoặc dữ liệu xác thực vào localStorage.
  const editDraftKey = adminUserEditDraftKey(editUser?.id)
  const editDraftValue = {
    userId: editUser?.id ?? null,
    form: {
      displayName: editForm.displayName || '',
      status: editForm.status || '',
      role: editForm.role || '',
    },
  }
  const { clear: clearEditDraft } = useDraftAutosave(
    editDraftKey,
    editDraftValue,
    {
      enabled: Boolean(editUser),
      dirty: Boolean(editUser) && (
        (editForm.displayName || '') !== (editUser.displayName || '')
        || editForm.status !== editUser.status
        || editForm.role !== editUser.role
      ),
    },
  )
  const createDraftValue = { form: { ...createForm } }
  const { clear: clearCreateDraft } = useDraftAutosave(
    ADMIN_USER_CREATE_DRAFT_KEY,
    createDraftValue,
    {
      enabled: createOpen,
      dirty: createOpen && isCreateFormDirty(),
    },
  )

  // ── Load list ───────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    fetchAdminUsers(query)
      .then((r) => {
        if (!active) return
        setListState({ status: 'success', items: r.items, pagination: r.pagination, warning: '' })
      })
      .catch((e) => {
        if (!active) return
        setListState({ status: 'error', items: [], pagination: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((p) => ({ ...p, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  // ── Handlers ────────────────────────────────────────────────────────────
  function openEdit(user) {
    const initialForm = { displayName: user.displayName || '', status: user.status || 'ACTIVE', role: user.role || '', newPassword: '' }
    const saved = readDraft(adminUserEditDraftKey(user.id))
    const savedForm = saved?.value?.userId === user.id ? saved.value.form : null
    setEditUser(user)
    setEditForm({ ...initialForm, ...(savedForm || {}), newPassword: '' })
    setEditError('')
    setEditFieldErrors({})
    setEditSuccess(false)
    if (savedForm) toast.info(t('adminUsers.draftRestored', { defaultValue: 'Đã khôi phục bản nháp tài khoản quản trị.' }))
  }

  function closeEdit() {
    clearEditDraft()
    setEditUser(null)
    setEditError('')
    setEditFieldErrors({})
    setEditSuccess(false)
  }

  // So khớp form sửa với dữ liệu gốc để biết còn thay đổi chưa lưu hay không.
  function isEditFormDirty() {
    if (!editUser) return false
    return (editForm.displayName || '') !== (editUser.displayName || '')
      || editForm.status !== editUser.status
      || editForm.role !== editUser.role
      || (editForm.newPassword || '').trim() !== ''
  }

  // Đóng drawer sửa có cảnh báo khi còn thay đổi chưa lưu (nút Huỷ / nút X / nền mờ).
  async function requestCloseEdit() {
    if (isEditFormDirty() && !editSaving) {
      const ok = await showConfirm(
        t('adminUsers.discardConfirm', { defaultValue: 'Bạn có thay đổi chưa lưu. Đóng sẽ mất các thay đổi đó. Tiếp tục?' }),
        t('adminUsers.discardTitle', { defaultValue: 'Bỏ thay đổi?' }),
      )
      if (!ok) return
    }
    closeEdit()
  }

  function openCreate() {
    const saved = readDraft(ADMIN_USER_CREATE_DRAFT_KEY)
    const savedForm = saved?.value?.form
    const role = savedForm?.role && createRoleOptions.includes(savedForm.role) ? savedForm.role : defaultRole
    setCreateForm(savedForm ? { ...savedForm, role } : { email: '', displayName: '', role: defaultRole })
    setCreateError('')
    setCreateOpen(true)
    if (savedForm) toast.info(t('adminUsers.draftRestored', { defaultValue: 'Đã khôi phục bản nháp tài khoản quản trị.' }))
  }

  function closeCreate() {
    clearCreateDraft()
    setCreateOpen(false)
    setCreateError('')
    setCreateFieldErrors({})
  }

  function isCreateFormDirty() {
    return createForm.email.trim() !== '' || createForm.displayName.trim() !== '' || createForm.role !== defaultRole
  }

  // Đóng modal tạo mới có cảnh báo khi đã nhập dở (nút Huỷ / nút X / nền mờ).
  async function requestCloseCreate() {
    if (isCreateFormDirty() && !createSaving) {
      const ok = await showConfirm(
        t('adminUsers.discardConfirm', { defaultValue: 'Bạn có thay đổi chưa lưu. Đóng sẽ mất các thay đổi đó. Tiếp tục?' }),
        t('adminUsers.discardTitle', { defaultValue: 'Bỏ thay đổi?' }),
      )
      if (!ok) return
    }
    closeCreate()
  }

  function handleFilterChange(field, value) {
    const next = { role: roleFilter, status: statusFilter, [field]: value }
    setRoleFilter(next.role)
    setStatusFilter(next.status)
    setQuery((p) => ({ ...p, role: next.role, status: next.status, page: 1 }))
  }

  // T10: xoá toàn bộ bộ lọc đang áp dụng — dùng chung cho nút trong thanh lọc,
  // chip lọc và trạng thái rỗng do lọc.
  function resetFilters() {
    setSearchInput('')
    setRoleFilter('')
    setStatusFilter('')
    setQuery((current) => ({ ...INITIAL_QUERY, pageSize: current.pageSize }))
  }

  // Kiểm tra hợp lệ phía client cho drawer sửa — trả về true nếu hợp lệ.
  function validateEditForm() {
    const errs = {}
    if (!(editForm.displayName || '').trim()) {
      errs.displayName = t('adminUsers.errDisplayNameRequired', { defaultValue: 'Vui lòng nhập tên hiển thị.' })
    }
    const pwd = (editForm.newPassword || '').trim()
    if (pwd && pwd.length < PASSWORD_MIN_LENGTH) {
      errs.newPassword = t('adminUsers.errPasswordTooShort', {
        defaultValue: 'Mật khẩu phải có ít nhất {{min}} ký tự.',
        min: PASSWORD_MIN_LENGTH,
      })
    }
    setEditFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Validate một ô của drawer sửa khi rời ô (on-blur), không xoá lỗi ô khác.
  function validateEditField(field) {
    if (field === 'displayName') {
      const err = !(editForm.displayName || '').trim()
        ? t('adminUsers.errDisplayNameRequired', { defaultValue: 'Vui lòng nhập tên hiển thị.' })
        : ''
      setEditFieldErrors((p) => ({ ...p, displayName: err || undefined }))
    } else if (field === 'newPassword') {
      const pwd = (editForm.newPassword || '').trim()
      const err = pwd && pwd.length < PASSWORD_MIN_LENGTH
        ? t('adminUsers.errPasswordTooShort', {
            defaultValue: 'Mật khẩu phải có ít nhất {{min}} ký tự.',
            min: PASSWORD_MIN_LENGTH,
          })
        : ''
      setEditFieldErrors((p) => ({ ...p, newPassword: err || undefined }))
    }
  }

  // Submit edit — with confirmation for sensitive changes.
  async function requestEditSubmit() {
    setEditError('')
    if (isSuperAdminAccountLocked) return
    if (!validateEditForm()) return

    const statusChanged = editForm.status !== editUser.status
    const roleChanged = canChangeRoles && editForm.role !== editUser.role
    const sensitiveStatus = statusChanged && editForm.status !== 'ACTIVE'
    const passwordChanged = editForm.newPassword.trim() !== ''

    const sensitiveChangeCount = [sensitiveStatus, passwordChanged, roleChanged].filter(Boolean).length
    if (sensitiveChangeCount > 1) {
      const ok = await showConfirm(
        t('adminUsers.confirmMultipleChanges'),
        t('adminUsers.confirmSensitiveTitle'),
        { variant: 'danger' },
      )
      if (!ok) return
    } else if (sensitiveStatus) {
      const ok = await showConfirm(
        t('adminUsers.confirmDisable'),
        t('adminUsers.confirmSensitiveTitle'),
        {
          variant: 'danger',
          confirmLabel: t('adminUsers.confirmDisableBtn', { defaultValue: 'Khoá tài khoản' }),
        },
      )
      if (!ok) return
    } else if (passwordChanged) {
      const ok = await showConfirm(
        t('adminUsers.confirmPasswordChange', { defaultValue: 'Bạn có chắc muốn đổi mật khẩu tài khoản này không?' }),
        t('adminUsers.confirmSensitiveTitle'),
        {
          variant: 'danger',
          confirmLabel: t('adminUsers.confirmPasswordChangeBtn', { defaultValue: 'Đổi mật khẩu' }),
        },
      )
      if (!ok) return
    } else if (roleChanged) {
      const ok = await showConfirm(t('adminUsers.confirmRoleChange'), t('adminUsers.confirmSensitiveTitle'))
      if (!ok) return
    }
    submitEdit()
  }

  const submitEdit = useCallback(async () => {
    if (!editUser) return
    setEditSaving(true)
    setEditError('')
    setEditFieldErrors({})
    setEditSuccess(false)
    try {
      // Never send role/status changes for the current user's own account.
      const editingSelf = currentUserId != null && editUser.id === currentUserId
      const payload = {
        displayName: editForm.displayName.trim() || undefined,
        status: editingSelf ? undefined : (editForm.status || undefined),
        role: editingSelf || !canChangeRoles ? undefined : (editForm.role || undefined),
        newPassword: editForm.newPassword.trim() || undefined,
      }
      const r = await updateAdminUser(editUser.id, payload)
      setListState((p) => ({ ...p, items: p.items.map((u) => (u.id === editUser.id ? r.item : u)) }))
      setEditUser(r.item)
      // Đồng bộ form với dữ liệu vừa lưu + xoá ô mật khẩu để không bị coi là còn thay đổi
      // (tránh hỏi "bỏ thay đổi?" nhầm khi đóng sau khi đã lưu thành công).
      setEditForm({ displayName: r.item.displayName || '', status: r.item.status || 'ACTIVE', role: r.item.role || '', newPassword: '' })
      clearEditDraft()
      setEditSuccess(true)
      if (payload.role || payload.status || payload.newPassword) {
        toast.success(t('adminUsers.accessApplied'))
      }
      if (r.item.role !== editForm.role && editForm.role) {
        // Vai trò bị bỏ qua (do quyền) → gắn cạnh ô vai trò, không để ở banner.
        setEditFieldErrors({ role: t('adminUsers.roleIgnored') })
      }
    } catch (err) {
      // Gắn lỗi xác thực vào đúng ô; lỗi không thuộc ô nào giữ ở banner đầu drawer.
      const fieldErrs = mapValidationErrors(err)
      if (Object.keys(fieldErrs).length > 0) {
        setEditFieldErrors(fieldErrs)
      } else {
        setEditError(getAdminUserErrorMessage(err, t))
      }
    } finally {
      setEditSaving(false)
    }
  }, [editUser, editForm, currentUserId, canChangeRoles, clearEditDraft, t])

  // Kiểm tra hợp lệ phía client cho form tạo mới — trả về true nếu hợp lệ.
  function validateCreateForm() {
    const errs = {}
    const email = createForm.email.trim()
    const displayName = createForm.displayName.trim()
    if (!email) {
      errs.email = t('adminUsers.errEmailRequired', { defaultValue: 'Vui lòng nhập email.' })
    } else if (!EMAIL_RE.test(email)) {
      errs.email = t('adminUsers.errEmailInvalid', { defaultValue: 'Email không hợp lệ.' })
    }
    if (!displayName) {
      errs.displayName = t('adminUsers.errDisplayNameRequired', { defaultValue: 'Vui lòng nhập tên hiển thị.' })
    }
    setCreateFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Validate một ô của form tạo mới khi rời ô (on-blur), không xoá lỗi ô khác.
  function validateCreateField(field) {
    if (field === 'email') {
      const email = createForm.email.trim()
      let err = ''
      if (!email) {
        err = t('adminUsers.errEmailRequired', { defaultValue: 'Vui lòng nhập email.' })
      } else if (!EMAIL_RE.test(email)) {
        err = t('adminUsers.errEmailInvalid', { defaultValue: 'Email không hợp lệ.' })
      }
      setCreateFieldErrors((p) => ({ ...p, email: err || undefined }))
    } else if (field === 'displayName') {
      const displayName = createForm.displayName.trim()
      const err = !displayName
        ? t('adminUsers.errDisplayNameRequired', { defaultValue: 'Vui lòng nhập tên hiển thị.' })
        : ''
      setCreateFieldErrors((p) => ({ ...p, displayName: err || undefined }))
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError('')
    if (!validateCreateForm()) return
    setCreateSaving(true)
    setCreateFieldErrors({})
    try {
      const r = await createAdminUser({
        email: createForm.email.trim(),
        displayName: createForm.displayName.trim(),
        role: createForm.role,
      })
      setListState((p) => ({ ...p, items: [r.item, ...p.items] }))
      setInviteInfo({ email: r.item.email, emailSent: r.inviteEmailSent, inviteUrl: r.inviteUrl })
      closeCreate()
    } catch (err) {
      const fieldErrs = mapValidationErrors(err)
      if (Object.keys(fieldErrs).length > 0) {
        setCreateFieldErrors(fieldErrs)
      } else {
        setCreateError(getAdminUserErrorMessage(err, t))
      }
    } finally {
      setCreateSaving(false)
    }
  }

  async function handleResendInvite(user) {
    if (resendingId) return
    setResendingId(user.id)
    try {
      const r = await resendAdminInvite(user.id)
      setInviteInfo({ email: user.email, emailSent: r.inviteEmailSent, inviteUrl: r.inviteUrl })
    } catch (err) {
      setInviteInfo({ email: user.email, emailSent: false, inviteUrl: '', error: getAdminUserErrorMessage(err, t) })
    } finally {
      setResendingId(null)
    }
  }

  // Kích hoạt / khoá tài khoản ngay trên dòng — 1 chạm thay vì mở drawer 4 bước.
  // Dùng lại đúng cập nhật trạng thái của drawer (updateAdminUser) + xác nhận khi khoá.
  async function handleToggleStatus(user) {
    if (togglingId) return // đang có 1 thao tác kích hoạt/khoá chạy dở — chặn bấm chồng
    const activating = user.status !== 'ACTIVE'
    if (!activating) {
      const ok = await showConfirm(
        t('adminUsers.confirmDisable'),
        t('adminUsers.confirmSensitiveTitle'),
        { variant: 'danger', confirmLabel: t('adminUsers.actionLock') },
      )
      if (!ok) return
    }
    setTogglingId(user.id)
    try {
      const r = await updateAdminUser(user.id, { status: activating ? 'ACTIVE' : 'DISABLED' })
      setListState((p) => ({ ...p, items: p.items.map((x) => (x.id === user.id ? r.item : x)) }))
      toast.success(activating ? t('adminUsers.activatedToast') : t('adminUsers.lockedToast'))
    } catch (err) {
      toast.error(getAdminUserErrorMessage(err, t))
    } finally {
      setTogglingId(null)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const isSelf = editUser != null && currentUserId != null && editUser.id === currentUserId
  const isSuperAdminAccountLocked = editUser?.role === 'SUPER_ADMIN' && !isSuperAdmin
  const hasFilters = searchInput.trim() !== '' || roleFilter !== '' || statusFilter !== ''
  const isEmptyResult = listState.status === 'success' && listState.items.length === 0

  // T10: chip lọc — một chip cho mỗi bộ lọc đang bật, gỡ được từng cái riêng.
  const activeFilterChips = []
  if (searchInput.trim()) {
    const term = searchInput.trim()
    activeFilterChips.push({
      key: 'search',
      label: t('adminUsers.chipSearch', { term, defaultValue: `Tìm: "${term}"` }),
      onRemove: () => setSearchInput(''),
    })
  }
  if (roleFilter) {
    const roleLabel = resolveRoleLabel(roleFilter)
    activeFilterChips.push({
      key: 'role',
      label: t('adminUsers.chipRole', { value: roleLabel, defaultValue: `Vai trò: ${roleLabel}` }),
      onRemove: () => handleFilterChange('role', ''),
    })
  }
  if (statusFilter) {
    const statusLabel = STATUS_META[statusFilter] ? t(STATUS_META[statusFilter].labelKey) : statusFilter
    activeFilterChips.push({
      key: 'status',
      label: t('adminUsers.chipStatus', { value: statusLabel, defaultValue: `Trạng thái: ${statusLabel}` }),
      onRemove: () => handleFilterChange('status', ''),
    })
  }

  // Sắp xếp phía client theo cột đang chọn (chỉ trên trang hiện tại).
  // Màu avatar được băm từ định danh tài khoản nên không đổi khi sắp xếp.
  const items = useMemo(() => {
    const base = listState.items || []
    let ordered = base
    if (sort.key) {
      const factor = sort.dir === 'asc' ? 1 : -1
      const valueOf = (u) => {
        if (sort.key === 'user') return (u.displayName || u.email || '').toLowerCase()
        if (sort.key === 'role') return (u.role || '').toLowerCase()
        if (sort.key === 'status') return (u.status || '').toLowerCase()
        if (sort.key === 'lastLogin') return u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0
        return ''
      }
      ordered = [...base].sort((a, b) => {
        const av = valueOf(a)
        const bv = valueOf(b)
        if (av < bv) return -1 * factor
        if (av > bv) return 1 * factor
        return 0
      })
    }
    return ordered
  }, [listState.items, sort])

  const isLoading = listState.status === 'loading' && (listState.items || []).length === 0

  // Nút kích hoạt/khoá dùng chung cho cả bảng và thẻ mobile. Ẩn với tài khoản chờ
  // kích hoạt (INVITED — chưa nhận lời mời) và với chính tài khoản đang đăng nhập.
  const statusToggleButton = (u) => {
    if (u.status === 'INVITED') return null
    if (currentUserId != null && u.id === currentUserId) return null
    if (u.role === 'SUPER_ADMIN' && !isSuperAdmin) return null
    const activating = u.status !== 'ACTIVE'
    const label = activating ? t('adminUsers.actionActivate') : t('adminUsers.actionLock')
    return (
      <Button variant="unstyled" type="button" className="bb-icon-btn" title={label} aria-label={label}
        disabled={Boolean(togglingId)} onClick={() => handleToggleStatus(u)}>
        {activating ? <UserCheck size={14} /> : <Lock size={14} />}
      </Button>
    )
  }

  const columns = [
    {
      key: 'user',
      label: t('adminUsers.colUser'),
      sortable: true,
      skeletonWidth: '70%',
      render: (u) => {
        const name = u.displayName || u.email
        return (
          <div className="product-cell">
            <span className={`inline-flex items-center justify-center size-12 rounded-full text-sm font-bold flex-shrink-0 ${avatarColorFor(u)}`}>
              {(name || '?').charAt(0).toUpperCase()}
            </span>
            <div className="info">
              <div className="name">{name}</div>
              {u.displayName && (
                <div className="sku font-body">{u.email}</div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'role',
      label: t('adminUsers.colRole'),
      sortable: true,
      skeletonWidth: '50%',
      render: (u) => <RoleBadge role={u.role} label={resolveRoleLabel(u.role)} />,
    },
    {
      key: 'status',
      label: t('adminUsers.colStatus'),
      sortable: true,
      skeletonWidth: '50%',
      render: (u) => <UserStatusBadge status={u.status} t={t} />,
    },
    {
      key: 'lastLogin',
      label: t('adminUsers.colLastLogin'),
      align: 'right',
      sortable: true,
      skeletonWidth: '60%',
      render: (u) => (
        <span className="bb-muted text-xs">
          {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : t('adminUsers.notLastLogin')}
        </span>
      ),
    },
    ...(canUpdate
      ? [{
          key: 'actions',
          label: '',
          align: 'right',
          render: (u) => (
            <div className="inline-flex items-center justify-end gap-1">
              {u.status === 'INVITED' && (
                <Button variant="unstyled" type="button" className="bb-icon-btn" title={t('adminUsers.resendInvite')} aria-label={t('adminUsers.resendInvite')} disabled={Boolean(resendingId)} onClick={() => handleResendInvite(u)}>
                  <Mail size={14} />
                </Button>
              )}
              {statusToggleButton(u)}
              <Button variant="unstyled" type="button" className="bb-icon-btn" title={t('common.edit')} aria-label={t('common.edit')} onClick={() => openEdit(u)}>
                <Pencil size={14} />
              </Button>
            </div>
          ),
        }]
      : []),
  ]

  // T7: cho phép ẩn/hiện cột trên bảng tài khoản quản trị, lưu lựa chọn theo trình duyệt.
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:admin-users')

  const mobileCard = (u) => {
    const name = u.displayName || u.email
    return {
      title: (
        <span className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center size-8 rounded-full text-xs font-bold flex-shrink-0 ${avatarColorFor(u)}`}>
            {(name || '?').charAt(0).toUpperCase()}
          </span>
          {name}
        </span>
      ),
      subtitle: u.displayName ? u.email : undefined,
      status: <UserStatusBadge status={u.status} t={t} />,
      meta: [
        { label: t('adminUsers.colRole'), value: <RoleBadge role={u.role} label={resolveRoleLabel(u.role)} /> },
        { label: t('adminUsers.colLastLogin'), value: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : t('adminUsers.notLastLogin') },
      ],
      actions: canUpdate ? (
        <>
          {u.status === 'INVITED' && (
            <Button variant="unstyled" type="button" className="bb-icon-btn" title={t('adminUsers.resendInvite')} aria-label={t('adminUsers.resendInvite')} disabled={Boolean(resendingId)} onClick={() => handleResendInvite(u)}>
              <Mail size={14} />
            </Button>
          )}
          {statusToggleButton(u)}
          <Button variant="unstyled" type="button" className="bb-icon-btn" title={t('common.edit')} aria-label={t('common.edit')} onClick={() => openEdit(u)}>
            <Pencil size={14} />
          </Button>
        </>
      ) : undefined,
    }
  }

  return (
    <div>
      <ScreenHeader
        eyebrow={t('adminUsers.eyebrow')}
        title={t('adminUsers.title')}
        description={t('adminUsers.description')}
        actions={canUpdate ? (
            <Button
              type="button"
              onClick={openCreate}
              disabled={!canChangeRoles}
              title={!canChangeRoles ? 'Cần quyền roles.read và danh sách vai trò để chọn vai trò cho tài khoản mới.' : undefined}
            >
              <UserPlus size={14} />{t('adminUsers.createBtn')}
            </Button>
        ) : null}
      />

      {listState.warning ? <ReadOnlyBanner warning={listState.warning} /> : null}
      {!canUpdate && !listState.warning ? (
        <ReadOnlyBanner warning={t('adminUsers.readOnlyHint')} />
      ) : null}
      {canUpdate && !canReadRoles ? (
        <Alert tone="warning" icon={Lock}>
          Cần quyền roles.read để lọc theo vai trò, mời tài khoản mới hoặc thay đổi vai trò. Các thao tác tên, mật khẩu và trạng thái vẫn khả dụng.
        </Alert>
      ) : null}

      {rolesError && (
        <Alert tone="warning" icon={AlertCircle} dismissible onDismiss={() => setRolesError(false)}>
          {t('adminUsers.rolesLoadError', { defaultValue: 'Không tải được danh sách vai trò. Không thể bảo đảm lựa chọn vai trò đầy đủ; thử tải lại trang.' })}
        </Alert>
      )}

      {inviteInfo && (
        <Alert tone="info" icon={Mail} dismissible onDismiss={() => setInviteInfo(null)}>
          {inviteInfo.error
            ? <span className="text-danger">{inviteInfo.error}</span>
            : inviteInfo.emailSent
              ? <span>{t('adminUsers.inviteSent', { email: inviteInfo.email })}</span>
              : (
                <div className="flex flex-col gap-1">
                  <span>{t('adminUsers.inviteNotEmailed', { email: inviteInfo.email })}</span>
                  {inviteInfo.inviteUrl && (
                    <code className="break-all rounded bg-muted px-2 py-1 text-xs">{inviteInfo.inviteUrl}</code>
                  )}
                </div>
              )}
        </Alert>
      )}

      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('adminUsers.searchPlaceholder')}
        />
        <FilterSelect
          value={roleFilter}
          onValueChange={(v) => handleFilterChange('role', v)}
          ariaLabel={t('adminUsers.filterRole')}
          disabled={!canReadRoles}
          options={[
            { value: '', label: t('adminUsers.filterRole') },
            ...roleOptions.map((r) => ({ value: r, label: resolveRoleLabel(r) })),
          ]}
        />
        <FilterSelect
          value={statusFilter}
          onValueChange={(v) => handleFilterChange('status', v)}
          ariaLabel={t('adminUsers.filterStatus')}
          options={[
            { value: '', label: t('adminUsers.filterStatus') },
            ...Object.entries(STATUS_META).map(([key, meta]) => ({ value: key, label: t(meta.labelKey) })),
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => setQuery((p) => ({ ...p, pageSize: n, page: 1 }))}
        />
        <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
      </div>

      {/* T10: chip lọc đang áp dụng + nút xoá tất cả — hiện cả khi vẫn còn kết quả. */}
      <FilterChips
        chips={activeFilterChips}
        onClearAll={resetFilters}
        clearAllLabel={t('common.resetFilters')}
        removeChipLabel={t('common.clear')}
        ariaLabel={t('adminUsers.activeFiltersAria', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {listState.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('adminUsers.error')}
          description={listState.error}
          actionLabel={t('common.retry')}
          onAction={() => setQuery((p) => ({ ...p }))}
        />
      )}

      {isEmptyResult && !hasFilters && (
        <StatePanel tone="neutral" title={t('adminUsers.empty')} description={t('adminUsers.emptyDesc')} />
      )}

      {isEmptyResult && hasFilters && (
        <StatePanel
          tone="neutral"
          title={t('adminUsers.emptySearch')}
          description={t('adminUsers.emptySearchDesc')}
          actionLabel={t('common.resetFilters')}
          onAction={resetFilters}
        />
      )}

      {(listState.status === 'loading' || (listState.status === 'success' && items.length > 0)) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <AdminTable
              columns={visibleColumns}
              rows={items}
              loading={isLoading}
              pageSize={query.pageSize}
              mobileCard={mobileCard}
              sortKey={sort.key}
              sortDir={sort.dir}
              onSortChange={(key, dir) => setSort({ key, dir })}
              rowClassName={(user) => `bb-row-accent--${STATUS_META[user.status]?.tone ?? 'muted'}`}
            />
          </div>
          {listState.status === 'success' && listState.pagination && (
            <div className="px-4">
              <PaginationControls
                pagination={listState.pagination}
                onPageChange={(newPage) => setQuery((p) => ({ ...p, page: newPage }))}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Edit Drawer ──────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(editUser)}
        title={t('adminUsers.editTitle')}
        onClose={requestCloseEdit}
        wide
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={requestCloseEdit}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              loading={editSaving}
              disabled={isSuperAdminAccountLocked || !isEditFormDirty()}
              onClick={requestEditSubmit}
            >
              {t('adminUsers.saveBtn')}
            </Button>
          </>
        }
      >
        {editUser && (
          <div className="audit-drawer-body !gap-0">
            {editError && (
              <p className="mb-4 flex items-center gap-1 text-sm text-danger" role="alert">
                <AlertCircle size={14} aria-hidden="true" className="shrink-0" />
                {editError}
              </p>
            )}
            {editSuccess && !editError && (
              <p className="mb-4 flex items-center gap-1 text-sm text-success" role="status">
                <CheckCircle2 size={14} aria-hidden="true" className="shrink-0" />
                {t('adminUsers.saveSuccess')}
              </p>
            )}

            <div className="au-drawer-section">
              <h3 className="au-drawer-section-title">{t('adminUsers.sectionAccount')}</h3>
              {isSelf && (
                <Alert tone="warning" size="sm" className="mb-3">
                  {t('adminUsers.selfEditLocked')}
                </Alert>
              )}
              {isSuperAdminAccountLocked && (
                <Alert tone="warning" size="sm" className="mb-3 break-words">
                  {t('adminUsers.superAdminEditLocked', { defaultValue: 'Chỉ Chủ hệ thống mới sửa được tài khoản Chủ hệ thống khác.' })}
                </Alert>
              )}
              <div className="au-form-grid">
                <FormField label={t('adminUsers.formDisplayName')} error={editFieldErrors.displayName}>
                  <Input
                    value={editForm.displayName}
                    onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                    onBlur={() => validateEditField('displayName')}
                    disabled={isSuperAdminAccountLocked}
                  />
                </FormField>
                <FormField label={t('adminUsers.formRole')} error={editFieldErrors.role}>
                  <Select
                    value={editForm.role}
                    disabled={isSelf || isSuperAdminAccountLocked || !canChangeRoles}
                    onValueChange={(val) => setEditForm((p) => ({ ...p, role: val }))}
                  >
                    <SelectTrigger aria-invalid={editFieldErrors.role ? true : undefined}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {editRoleOptions.map((r) => (
                        <SelectItem key={r} value={r}>{resolveRoleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label={t('adminUsers.formStatus')}
                  error={editFieldErrors.status}
                  helper={editUser.status === 'INVITED' ? t('adminUsers.inviteStatusLocked') : undefined}
                >
                  <Select
                    value={editForm.status}
                    disabled={isSelf || isSuperAdminAccountLocked || editUser.status === 'INVITED'}
                    onValueChange={(val) => setEditForm((p) => ({ ...p, status: val }))}
                  >
                    <SelectTrigger aria-invalid={editFieldErrors.status ? true : undefined}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {editUser.status === 'INVITED' && (
                        <SelectItem value="INVITED" disabled>{t(STATUS_META.INVITED.labelKey)}</SelectItem>
                      )}
                      {MANUALLY_EDITABLE_STATUSES.map((key) => (
                        <SelectItem key={key} value={key}>{t(STATUS_META[key].labelKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>

            <div className="au-drawer-section mt-6">
              <h3 className="au-drawer-section-title">{t('adminUsers.sectionPassword')}</h3>
              <PasswordField
                value={editForm.newPassword}
                onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))}
                onBlur={() => validateEditField('newPassword')}
                disabled={isSuperAdminAccountLocked}
                placeholder={t('adminUsers.formPasswordHint')}
                label={t('adminUsers.formPasswordNew')}
                hint={t('adminUsers.formPasswordStrengthHint')}
                error={editFieldErrors.newPassword}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        title={t('adminUsers.createTitle')}
        onClose={requestCloseCreate}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={requestCloseCreate}>{t('common.cancel')}</Button>
            <Button type="submit" form="create-user-form" size="sm" loading={createSaving}>
              {t('adminUsers.createBtn')}
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreate} className="flex flex-col gap-3">
          {createError && (
            <p className="flex items-center gap-1 text-sm text-danger" role="alert">
              <AlertCircle size={14} aria-hidden="true" className="shrink-0" />
              {createError}
            </p>
          )}
          <FormField label={t('adminUsers.formEmail')} required error={createFieldErrors.email}>
            <Input type="email" value={createForm.email}
              onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
              onBlur={() => validateCreateField('email')} required />
          </FormField>
          <FormField label={t('adminUsers.formDisplayName')} required error={createFieldErrors.displayName}>
            <Input value={createForm.displayName}
              onChange={(e) => setCreateForm((p) => ({ ...p, displayName: e.target.value }))}
              onBlur={() => validateCreateField('displayName')} required />
          </FormField>
          <FormField label={t('adminUsers.formRole')}>
            <Select value={createForm.role} onValueChange={(val) => setCreateForm((p) => ({ ...p, role: val }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {createRoleOptions.map((r) => (
                  <SelectItem key={r} value={r}>{resolveRoleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <p className="text-xs text-muted-foreground">{t('adminUsers.inviteHint')}</p>
        </form>
      </Modal>
    </div>
  )
}
