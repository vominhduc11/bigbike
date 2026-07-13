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
import { Modal } from '../components/layout'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createAdminUser, fetchAdminUsers, fetchRoles, resendAdminInvite, updateAdminUser, mapValidationErrors } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { showConfirm } from '../lib/confirm'
import { toast } from '@/lib/toast'
import { useDebounce } from '../lib/useDebounce'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '../components/PasswordInput'

const INITIAL_QUERY = { search: '', page: 1, pageSize: 20, role: '', status: '' }

// Đủ để bắt lỗi nhập sai phổ biến phía client; backend vẫn là nguồn xác thực cuối.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN_LENGTH = 8

// Static metadata for built-in roles (label i18n key).
const ROLE_META = {
  SUPER_ADMIN:  { labelKey: 'adminUsers.roleSuperAdmin'  },
  ADMIN:        { labelKey: 'adminUsers.roleAdmin'        },
  SHOP_MANAGER: { labelKey: 'adminUsers.roleShopManager'  },
  EDITOR:       { labelKey: 'adminUsers.roleEditor'       },
}

const STATUS_META = {
  INVITED:   { labelKey: 'adminUsers.statusInvited'   },
  ACTIVE:    { labelKey: 'adminUsers.statusActive'    },
  DISABLED:  { labelKey: 'adminUsers.statusDisabled'  },
  SUSPENDED: { labelKey: 'adminUsers.statusSuspended' },
}

// Role → bb-badge palette.
const ROLE_BADGE = {
  SUPER_ADMIN: 'bb-badge-danger',
  ADMIN: 'bb-badge-info',
  SHOP_MANAGER: 'bb-badge-info',
  EDITOR: 'bb-badge-neutral',
}
const STATUS_BADGE = {
  INVITED: 'bb-badge-info',
  ACTIVE: 'bb-badge-success',
  DISABLED: 'bb-badge-danger',
  SUSPENDED: 'bb-badge-warning',
}
const AVATAR_COLORS = [
  'bg-primary text-primary-foreground',
  'bg-info-bg text-info',
  'bg-success-bg text-success',
  'bg-warning-bg text-warning',
  'bg-danger-bg text-danger',
  'bg-secondary text-secondary-foreground',
]

function RoleBadge({ role, label }) {
  return <span className={`bb-badge ${ROLE_BADGE[role] || 'bb-badge-neutral'}`}>{label || '—'}</span>
}

function UserStatusBadge({ status, t }) {
  const meta = STATUS_META[status]
  const label = meta ? t(meta.labelKey) : status
  return (
    <span className={`bb-badge ${STATUS_BADGE[status] || 'bb-badge-neutral'}`}>
      <span className="dot" />{label || '—'}
    </span>
  )
}

function PasswordField({ value, onChange, onBlur, placeholder, label, hint, error }) {
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

export function AdminUsersScreen({ canUpdate, currentUserId }) {
  const { t } = useTranslation()

  // ── List state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  const [listState, setListState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  // Sắp xếp phía client (endpoint admin users không hỗ trợ sort server-side).
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  // ── Dynamic roles ───────────────────────────────────────────────────────
  const [dynamicRoles, setDynamicRoles] = useState([])
  const [rolesError, setRolesError] = useState(false)
  useEffect(() => {
    // Lỗi tải danh sách vai trò tuỳ chỉnh không còn bị nuốt: hiện cảnh báo để admin
    // biết danh sách vai trò có thể chưa đầy đủ (thay vì lặng lẽ thiếu lựa chọn).
    fetchRoles()
      .then((r) => { setDynamicRoles(r.items || []); setRolesError(false) })
      .catch(() => setRolesError(true))
  }, [])

  const roleOptions = useMemo(() => {
    const builtins = Object.keys(ROLE_META)
    const extras = dynamicRoles.filter((r) => !builtins.includes(r.id)).map((r) => r.id)
    return [...builtins, ...extras]
  }, [dynamicRoles])

  // Đổi mã vai trò thô (vd vai trò tuỳ chỉnh) sang nhãn dễ đọc: ưu tiên nhãn i18n của
  // vai trò dựng sẵn, rồi tên hiển thị của vai trò tuỳ chỉnh, cuối cùng mới là mã.
  const resolveRoleLabel = useCallback((roleId) => {
    if (!roleId) return '—'
    const meta = ROLE_META[roleId]
    if (meta) return t(meta.labelKey)
    const dyn = dynamicRoles.find((r) => r.id === roleId)
    return dyn?.name || roleId
  }, [dynamicRoles, t])

  // Chặn double-submit của nút kích hoạt/khoá ngay trên dòng: khoá nút đang xử lý.
  const [togglingId, setTogglingId] = useState(null)

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
    setEditUser(user)
    setEditForm({ displayName: user.displayName || '', status: user.status || 'ACTIVE', role: user.role || '', newPassword: '' })
    setEditError('')
    setEditFieldErrors({})
    setEditSuccess(false)
  }

  function closeEdit() {
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
    setCreateForm({ email: '', displayName: '', role: 'ADMIN' })
    setCreateError('')
    setCreateOpen(true)
  }

  function closeCreate() {
    setCreateOpen(false)
    setCreateError('')
    setCreateFieldErrors({})
  }

  function isCreateFormDirty() {
    return createForm.email.trim() !== '' || createForm.displayName.trim() !== '' || createForm.role !== 'ADMIN'
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
    setQuery(INITIAL_QUERY)
  }

  // Kiểm tra hợp lệ phía client cho drawer sửa — trả về true nếu hợp lệ.
  function validateEditForm() {
    const errs = {}
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
    if (field === 'newPassword') {
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
    if (!validateEditForm()) return

    const statusChanged = editForm.status !== editUser.status
    const roleChanged = editForm.role !== editUser.role
    const sensitiveStatus = statusChanged && editForm.status !== 'ACTIVE'

    if (sensitiveStatus) {
      const ok = await showConfirm(
        t('adminUsers.confirmDisable'),
        t('adminUsers.confirmSensitiveTitle'),
        {
          variant: 'danger',
          confirmLabel: t('adminUsers.confirmDisableBtn', { defaultValue: 'Khoá tài khoản' }),
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
        role: editingSelf ? undefined : (editForm.role || undefined),
        newPassword: editForm.newPassword.trim() || undefined,
      }
      const r = await updateAdminUser(editUser.id, payload)
      setListState((p) => ({ ...p, items: p.items.map((u) => (u.id === editUser.id ? r.item : u)) }))
      setEditUser(r.item)
      // Đồng bộ form với dữ liệu vừa lưu + xoá ô mật khẩu để không bị coi là còn thay đổi
      // (tránh hỏi "bỏ thay đổi?" nhầm khi đóng sau khi đã lưu thành công).
      setEditForm({ displayName: r.item.displayName || '', status: r.item.status || 'ACTIVE', role: r.item.role || '', newPassword: '' })
      setEditSuccess(true)
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
        setEditError(err.message || t('common.error'))
      }
    } finally {
      setEditSaving(false)
    }
  }, [editUser, editForm, currentUserId, t])

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
        setCreateError(err.message || t('common.error'))
      }
    } finally {
      setCreateSaving(false)
    }
  }

  async function handleResendInvite(user) {
    try {
      const r = await resendAdminInvite(user.id)
      setInviteInfo({ email: user.email, emailSent: r.inviteEmailSent, inviteUrl: r.inviteUrl })
    } catch (err) {
      setInviteInfo({ email: user.email, emailSent: false, inviteUrl: '', error: err.message || t('common.error') })
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
      toast.error(err.message || t('common.error'))
    } finally {
      setTogglingId(null)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const isSelf = editUser != null && currentUserId != null && editUser.id === currentUserId
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
  // Gắn _idx để màu avatar giữ ổn định theo thứ tự hiển thị.
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
    return ordered.map((u, i) => ({ ...u, _idx: i }))
  }, [listState.items, sort])

  const isLoading = listState.status === 'loading' && (listState.items || []).length === 0

  // Nút kích hoạt/khoá dùng chung cho cả bảng và thẻ mobile. Ẩn với tài khoản chờ
  // kích hoạt (INVITED — chưa nhận lời mời) và với chính tài khoản đang đăng nhập.
  const statusToggleButton = (u) => {
    if (u.status === 'INVITED') return null
    if (currentUserId != null && u.id === currentUserId) return null
    const activating = u.status !== 'ACTIVE'
    const label = activating ? t('adminUsers.actionActivate') : t('adminUsers.actionLock')
    return (
      <button type="button" className="bb-icon-btn" title={label} aria-label={label}
        disabled={togglingId === u.id} onClick={() => handleToggleStatus(u)}>
        {activating ? <UserCheck size={14} /> : <Lock size={14} />}
      </button>
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
            <span className={`inline-flex items-center justify-center size-12 rounded-full text-sm font-bold flex-shrink-0 ${AVATAR_COLORS[(u._idx ?? 0) % AVATAR_COLORS.length]}`}>
              {(name || '?').charAt(0).toUpperCase()}
            </span>
            <div className="info">
              <div className="name">{name}</div>
              {u.displayName && (
                <div className="sku" style={{ fontFamily: 'inherit' }}>{u.email}</div>
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
                <button type="button" className="bb-icon-btn" title={t('adminUsers.resendInvite')} aria-label={t('adminUsers.resendInvite')} onClick={() => handleResendInvite(u)}>
                  <Mail size={14} />
                </button>
              )}
              {statusToggleButton(u)}
              <button type="button" className="bb-icon-btn" title={t('common.edit')} aria-label={t('common.edit')} onClick={() => openEdit(u)}>
                <Pencil size={14} />
              </button>
            </div>
          ),
        }]
      : []),
  ]

  // T7: cho phép ẩn/hiện cột trên bảng quản trị viên, lưu lựa chọn theo trình duyệt.
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:admin-users')

  const mobileCard = (u) => {
    const name = u.displayName || u.email
    return {
      title: (
        <span className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center size-8 rounded-full text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[(u._idx ?? 0) % AVATAR_COLORS.length]}`}>
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
            <button type="button" className="bb-icon-btn" title={t('adminUsers.resendInvite')} aria-label={t('adminUsers.resendInvite')} onClick={() => handleResendInvite(u)}>
              <Mail size={14} />
            </button>
          )}
          {statusToggleButton(u)}
          <button type="button" className="bb-icon-btn" title={t('common.edit')} aria-label={t('common.edit')} onClick={() => openEdit(u)}>
            <Pencil size={14} />
          </button>
        </>
      ) : undefined,
    }
  }

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('adminUsers.eyebrow')}</p>
          <h1>{t('adminUsers.title')}</h1>
          <p className="bb-muted">{t('adminUsers.description')}</p>
        </div>
        {canUpdate && (
          <div className="bb-screen-actions">
            <Button type="button" onClick={openCreate}>
              <UserPlus size={14} />{t('adminUsers.createBtn')}
            </Button>
          </div>
        )}
      </div>

      {listState.warning ? <ReadOnlyBanner warning={listState.warning} /> : null}

      {rolesError && (
        <Alert tone="warning" icon={AlertCircle} dismissible onDismiss={() => setRolesError(false)}>
          {t('adminUsers.rolesLoadError', { defaultValue: 'Không tải được danh sách vai trò tuỳ chỉnh. Danh sách vai trò có thể chưa đầy đủ; thử tải lại trang.' })}
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
            />
          </div>
          {listState.status === 'success' && listState.pagination && (
            <PaginationControls
              pagination={listState.pagination}
              onPageChange={(newPage) => setQuery((p) => ({ ...p, page: newPage }))}
            />
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
            <Button type="button" size="sm" loading={editSaving} onClick={requestEditSubmit}>
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
              <div className="au-form-grid">
                <FormField label={t('adminUsers.formDisplayName')} error={editFieldErrors.displayName}>
                  <Input
                    value={editForm.displayName}
                    onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                  />
                </FormField>
                <FormField label={t('adminUsers.formRole')} error={editFieldErrors.role}>
                  <Select
                    value={editForm.role}
                    disabled={isSelf}
                    onValueChange={(val) => setEditForm((p) => ({ ...p, role: val }))}
                  >
                    <SelectTrigger aria-invalid={editFieldErrors.role ? true : undefined}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r} value={r}>{resolveRoleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={t('adminUsers.formStatus')} error={editFieldErrors.status}>
                  <Select
                    value={editForm.status}
                    disabled={isSelf}
                    onValueChange={(val) => setEditForm((p) => ({ ...p, status: val }))}
                  >
                    <SelectTrigger aria-invalid={editFieldErrors.status ? true : undefined}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_META).map(([key, meta]) => (
                        <SelectItem key={key} value={key}>{t(meta.labelKey)}</SelectItem>
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
                {roleOptions.map((r) => (
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
