import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { FilterChips } from '../components/FilterChips'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Eye, EyeOff, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  createRedirect,
  deleteRedirect,
  fetchRedirects,
  mapValidationErrors,
  updateRedirect,
} from '../lib/adminApi'
import { PaginationControls } from '../components/PaginationControls'
import { AdminTable } from '../components/AdminTable'
import { TableRowActions } from '../components/TableRowActions'
import { BulkActionBar } from '../components/BulkActionBar'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { FormField } from '../components/layout/FormField'
import { ResponsiveFilterBar, Screen, ScreenHeader } from '../components/layout'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { enabledRowAccent } from '../lib/statusTone'
import { useDebounce } from '../lib/useDebounce'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { formatDateTime } from '../lib/formatters'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { useAdminList } from '../lib/useAdminList'
import { validateRedirectSource, validateRedirectTarget } from '../lib/urlPolicies'

const INITIAL_QUERY = {
  search: '',
  enabled: 'ALL',
  page: 1,
  pageSize: 20,
}

const EMPTY_FORM = {
  sourcePattern: '',
  targetUrl: '',
  enabled: true,
  statusCode: 301,
}

const PAGE_SIZES = new Set([20, 50, 100])

function initialRedirectQuery() {
  const raw = readQueryFromUrl(INITIAL_QUERY)
  return {
    search: typeof raw.search === 'string' ? raw.search.slice(0, 200) : '',
    enabled: ['ALL', 'true', 'false'].includes(raw.enabled) ? raw.enabled : 'ALL',
    page: Number.isInteger(raw.page) && raw.page > 0 ? raw.page : 1,
    pageSize: PAGE_SIZES.has(raw.pageSize) ? raw.pageSize : 20,
  }
}

export function RedirectListScreen({ canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isFirstSearchRender = useRef(true)
  const [query, setQuery] = useState(initialRedirectQuery)
  const [searchInput, setSearchInput] = useState(() => query.search)
  const debouncedSearch = useDebounce(searchInput, 300)
  const [showForm, setShowForm] = useState(false)
  const [editingRedirect, setEditingRedirect] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // F6: bản chụp form lúc mở, dùng để biết có thay đổi chưa lưu — mirror SliderListScreen.
  const [baseline, setBaseline] = useState(null)
  const [touched, setTouched] = useState({})
  const [formError, setFormError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})
  // O6: chọn nhiều dòng để bật/tắt/xoá hàng loạt.
  const [selected, setSelected] = useState([])
  const [bulkBusy, setBulkBusy] = useState(false)

  const queryKey = useMemo(
    () => ['redirects', query.search, query.enabled, query.page, query.pageSize],
    [query.search, query.enabled, query.page, query.pageSize],
  )

  const state = useAdminList(queryKey, () => fetchRedirects(query))

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    setSelected([])
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    if (state.status !== 'success' || !state.pagination) return
    const lastPage = Math.max(1, state.pagination.totalPages || 0)
    if (query.page <= lastPage) return
    const correctionTimer = window.setTimeout(() => {
      setSelected([])
      setQuery((previous) => ({ ...previous, page: lastPage }))
    }, 0)
    return () => window.clearTimeout(correctionTimer)
  }, [query.page, state.pagination, state.status])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sourcePattern: form.sourcePattern.trim(),
        targetUrl: form.targetUrl.trim(),
        enabled: form.enabled,
        statusCode: Number(form.statusCode) === 410 ? 410 : 301,
      }
      return editingRedirect
        ? updateRedirect(editingRedirect.id, payload)
        : createRedirect(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      closeForm()
      toast.success(
        editingRedirect
          ? t('redirects.updateSuccess', { defaultValue: 'Đã cập nhật chuyển hướng.' })
          : t('redirects.createSuccess', { defaultValue: 'Đã tạo chuyển hướng.' }),
      )
    },
    onError: (err) => {
      if (err?.code === 'CONFLICT') {
        setValidationErrors({
          sourcePattern: t('redirects.errorSourceConflict', {
            defaultValue: 'Nguồn này đã có chuyển hướng khác trỏ tới. Hãy dùng mẫu nguồn khác hoặc sửa bản ghi đang có.',
          }),
        })
        setFormError('')
        return
      }
      const fieldErrors = mapValidationErrors(err)
      setValidationErrors(fieldErrors)
      setFormError(Object.keys(fieldErrors).length > 0 ? '' : (err?.message || t('common.error')))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (redirectId) => deleteRedirect(redirectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      toast.success(t('redirects.deleteSuccess', { defaultValue: 'Đã xoá chuyển hướng.' }))
    },
    onError: (err) => toast.error(err?.message || t('redirects.deleteError', { defaultValue: 'Không thể xoá chuyển hướng.' })),
  })

  // O4: toggle nhanh Bật/Tắt ngay trên bảng — cập nhật lạc quan (onMutate + rollback),
  // mượn đúng mẫu BrandListScreen.toggleVisibilityMutation.
  const toggleEnabledMutation = useMutation({
    mutationFn: ({ id, enabled }) => updateRedirect(id, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['redirects'] })
      const previousQueries = queryClient.getQueriesData({ queryKey: ['redirects'] })
      queryClient.setQueriesData({ queryKey: ['redirects'] }, (old) => {
        if (!old?.items) return old
        return { ...old, items: old.items.map((r) => (r.id === id ? { ...r, enabled } : r)) }
      })
      return { previousQueries }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      toast.success(t('redirects.toggleSuccess', { defaultValue: 'Đã cập nhật trạng thái.' }))
    },
    onError: (err, _variables, context) => {
      context?.previousQueries?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error(err?.message || t('common.error'))
    },
  })

  function handleToggleEnabled(redirect) {
    if (!canUpdate || toggleEnabledMutation.isPending) return
    toggleEnabledMutation.mutate({ id: redirect.id, enabled: redirect.enabled === false })
  }

  // O6: bật/tắt hàng loạt — không cần confirm (đối xứng với hành động đơn lẻ trên hàng).
  async function handleBulkSetEnabled(enabled) {
    const ids = [...selected]
    if (!canUpdate || bulkBusy || ids.length === 0) return
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(ids.map((id) => updateRedirect(id, { enabled })))
      const failedIds = ids.filter((_, index) => results[index].status === 'rejected')
      await queryClient.invalidateQueries({ queryKey: ['redirects'] })
      setSelected(failedIds)
      if (failedIds.length === 0) {
        toast.success(enabled
          ? t('redirects.bulkEnableSuccess', { count: ids.length, defaultValue: `Đã bật ${ids.length} chuyển hướng.` })
          : t('redirects.bulkDisableSuccess', { count: ids.length, defaultValue: `Đã tắt ${ids.length} chuyển hướng.` }))
      } else {
        toast.error(t('redirects.bulkPartialError', {
          success: ids.length - failedIds.length,
          failed: failedIds.length,
          defaultValue: `Đã cập nhật ${ids.length - failedIds.length}; còn ${failedIds.length} mục chưa thành công.`,
        }))
      }
    } finally {
      setBulkBusy(false)
    }
  }

  // O6: xoá hàng loạt — có confirm vì không thể hoàn tác.
  async function handleBulkDelete() {
    const count = selected.length
    if (!canUpdate || bulkBusy || count === 0) return
    const confirmed = await showConfirm(
      t('redirects.bulkDeleteConfirm', { count, defaultValue: `Xoá ${count} chuyển hướng đã chọn? Thao tác này không thể hoàn tác.` }),
      t('common.permanentDeleteTitle'),
      { confirmLabel: t('common.permanentDelete'), variant: 'danger' },
    )
    if (!confirmed) return
    setBulkBusy(true)
    try {
      const ids = [...selected]
      const results = await Promise.allSettled(ids.map((id) => deleteRedirect(id)))
      const failedIds = ids.filter((_, index) => results[index].status === 'rejected')
      await queryClient.invalidateQueries({ queryKey: ['redirects'] })
      setSelected(failedIds)
      if (failedIds.length === 0) {
        toast.success(t('redirects.bulkDeleteSuccess', { count, defaultValue: `Đã xoá ${count} chuyển hướng.` }))
      } else {
        toast.error(t('redirects.bulkDeletePartialError', {
          success: count - failedIds.length,
          failed: failedIds.length,
          defaultValue: `Đã xoá ${count - failedIds.length}; còn ${failedIds.length} mục chưa xoá được.`,
        }))
      }
    } finally {
      setBulkBusy(false)
    }
  }

  const items = state.items
  const pagination = state.pagination
  const isFiltered = Boolean(query.search) || query.enabled !== 'ALL'
  const isActionBusy = saveMutation.isPending
    || deleteMutation.isPending
    || toggleEnabledMutation.isPending
    || bulkBusy

  const sourceValidation = validateRedirectSource(form.sourcePattern)
  const targetValidation = validateRedirectTarget(form.targetUrl)
  const sourceError = !sourceValidation.valid
    ? t(
      sourceValidation.reason === 'required'
        ? 'redirects.errorSourceRequired'
        : 'redirects.errorSourceInvalid',
      {
        defaultValue: sourceValidation.reason === 'required'
          ? 'Địa chỉ cũ là bắt buộc.'
          : 'Địa chỉ cũ phải là đường dẫn trong website, không gồm tên miền, query hoặc dấu #.',
      },
    )
    : ''
  const targetError = !targetValidation.valid
    ? t(
      targetValidation.reason === 'required'
        ? 'redirects.errorTargetRequired'
        : 'redirects.errorTargetInvalid',
      {
        defaultValue: targetValidation.reason === 'required'
          ? 'Địa chỉ mới là bắt buộc.'
          : 'Địa chỉ mới phải là đường dẫn nội bộ hoặc URL thuộc BigBike.',
      },
    )
    : ''

  function updateFormField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setValidationErrors((previous) => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
    setFormError('')
  }

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function openCreateForm() {
    setEditingRedirect(null)
    const next = { ...EMPTY_FORM }
    setForm(next)
    setBaseline(next)
    setTouched({})
    setFormError('')
    setValidationErrors({})
    setShowForm(true)
  }

  function openEditForm(redirect) {
    setEditingRedirect(redirect)
    const next = {
      sourcePattern: redirect.sourcePattern || '',
      targetUrl: redirect.targetUrl || '',
      enabled: redirect.enabled !== false,
      statusCode: redirect.statusCode === 410 ? 410 : 301,
    }
    setForm(next)
    setBaseline(next)
    setTouched({})
    setFormError('')
    setValidationErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingRedirect(null)
    setForm(EMPTY_FORM)
    setBaseline(null)
    setTouched({})
    setFormError('')
    setValidationErrors({})
  }

  // F6: form đang có thay đổi chưa lưu khi đang mở và khác bản chụp lúc mở (mirror SliderListScreen).
  const isDirty = useMemo(() => {
    if (!showForm || !baseline) return false
    return JSON.stringify(form) !== JSON.stringify(baseline)
  }, [showForm, baseline, form])

  // F5/F6: Huỷ khi form còn thay đổi chưa lưu → xác nhận trước để không mất bản nháp.
  async function confirmCloseForm() {
    if (isDirty) {
      const ok = await showConfirm(
        t('redirects.unsavedConfirm', {
          defaultValue: 'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất những thay đổi đó. Tiếp tục?',
        }),
        t('redirects.unsavedTitle', { defaultValue: 'Có thay đổi chưa lưu' }),
      )
      if (!ok) return
    }
    closeForm()
  }

  useUnsavedChanges(isDirty, t('redirects.unsavedConfirm', {
    defaultValue: 'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất những thay đổi đó. Tiếp tục?',
  }))

  // O3: Ctrl/Cmd+S lưu form chuyển hướng khi đang mở.
  useSaveShortcut(showForm && canUpdate, handleSubmit)

  const handleDelete = useCallback(async (redirect) => {
    if (deleteMutation.isPending) return
    const confirmed = await showConfirm(
      t('redirects.deleteConfirm', {
        defaultValue: `Xoá vĩnh viễn chuyển hướng "${redirect.sourcePattern}". Thao tác này không thể hoàn tác.`,
        source: redirect.sourcePattern,
      }),
      t('common.permanentDeleteTitle'),
      { confirmLabel: t('common.permanentDelete'), variant: 'danger' },
    )
    if (!confirmed) return
    deleteMutation.mutate(redirect.id)
  }, [deleteMutation, t])

  function updateQuery(partial, { resetPage = false } = {}) {
    setSelected([])
    setQuery((prev) => {
      const next = { ...prev, ...partial }
      if (resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setSelected([])
    setQuery((current) => ({ ...INITIAL_QUERY, pageSize: current.pageSize }))
  }

  function handleSubmit(event) {
    event?.preventDefault?.()
    if (saveMutation.isPending) return
    if (sourceError || targetError) {
      setTouched((prev) => ({ ...prev, sourcePattern: true, targetUrl: true }))
      setFormError('')
      return
    }
    setFormError('')
    setValidationErrors({})
    saveMutation.mutate()
  }

  const activeFilterChips = []
  if (query.search) {
    activeFilterChips.push({
      key: 'search',
      label: t('redirects.filterChipSearch', { value: query.search, defaultValue: `Tìm: "{{value}}"` }),
      removeLabel: t('redirects.removeFilter', { filter: t('common.search'), defaultValue: `Bỏ lọc {{filter}}` }),
      onRemove: () => {
        setSearchInput('')
        updateQuery({ search: '' }, { resetPage: true })
      },
    })
  }
  if (query.enabled !== 'ALL') {
    activeFilterChips.push({
      key: 'enabled',
      label: t('redirects.filterChipEnabled', {
        // V5: dùng nhãn "Bật"/"Tắt" tiếng Việt đồng nhất với badge/dropdown thay vì common.on/off (ON/OFF).
        value: query.enabled === 'true'
          ? t('redirects.statusOn', { defaultValue: 'Bật' })
          : t('redirects.statusOff', { defaultValue: 'Tắt' }),
        defaultValue: `Bật: {{value}}`,
      }),
      removeLabel: t('redirects.removeFilter', { filter: t('redirects.filterEnabled', { defaultValue: 'Bật' }), defaultValue: `Bỏ lọc {{filter}}` }),
      onRemove: () => updateQuery({ enabled: 'ALL' }, { resetPage: true }),
    })
  }

  // V5: nhãn "Bật/Tắt" tiếng Việt đồng nhất với formEnabled thay vì common.on/off tiếng Anh.
  const enabledBadge = (redirect) => {
    if (redirect.enabled !== true && redirect.enabled !== false) {
      return (
        <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
          {t('common.unknown', { defaultValue: 'Không xác định' })}
        </span>
      )
    }
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${redirect.enabled ? 'bg-success-bg text-success' : 'bg-surface-muted text-muted-foreground'}`}>
        {redirect.enabled ? t('redirects.statusOn', { defaultValue: 'Bật' }) : t('redirects.statusOff', { defaultValue: 'Tắt' })}
      </span>
    )
  }

  const statusCodeBadge = (redirect) => (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${redirect.statusCode === 410 ? 'bg-warning-bg text-warning' : 'bg-info-bg text-info'}`}>
      {redirect.statusCode === 410
        ? t('redirects.status410', { defaultValue: '410 — Đã gỡ' })
        : t('redirects.status301', { defaultValue: '301 — Chuyển hướng' })}
    </span>
  )

  const rowActions = (redirect) => {
    const enabled = redirect.enabled !== false
    const toggleLabel = enabled
      ? t('redirects.statusOff', { defaultValue: 'Tắt' })
      : t('redirects.statusOn', { defaultValue: 'Bật' })
    const toggleAria = enabled
      ? t('redirects.disableNamed', { source: redirect.sourcePattern, defaultValue: `Tắt chuyển hướng ${redirect.sourcePattern}` })
      : t('redirects.enableNamed', { source: redirect.sourcePattern, defaultValue: `Bật chuyển hướng ${redirect.sourcePattern}` })
    return (
      <TableRowActions
        primaryActions={[
          {
            key: 'edit',
            label: t('common.edit'),
            ariaLabel: t('redirects.editNamed', { source: redirect.sourcePattern, defaultValue: `Sửa chuyển hướng ${redirect.sourcePattern}` }),
            icon: Pencil,
            disabled: isActionBusy,
            onSelect: () => openEditForm(redirect),
          },
          {
            key: 'toggle',
            label: toggleLabel,
            ariaLabel: toggleAria,
            icon: enabled ? EyeOff : Eye,
            disabled: isActionBusy,
            onSelect: () => handleToggleEnabled(redirect),
          },
        ]}
        menuActions={[{
          key: 'delete',
          label: t('common.delete'),
          ariaLabel: t('redirects.deleteNamed', { source: redirect.sourcePattern, defaultValue: `Xoá chuyển hướng ${redirect.sourcePattern}` }),
          icon: Trash2,
          tone: 'danger',
          disabled: isActionBusy,
          onSelect: () => handleDelete(redirect),
        }]}
      />
    )
  }

  const columns = [
    {
      key: 'sourcePattern',
      label: t('redirects.colSource', { defaultValue: 'Nguồn' }),
      render: (redirect) => <span className="break-all font-mono text-sm">{redirect.sourcePattern || t('common.notFound')}</span>,
    },
    {
      key: 'targetUrl',
      label: t('redirects.colTarget', { defaultValue: 'Đích' }),
      render: (redirect) => (
        <span className="inline-flex items-start gap-2 break-all">
          <ArrowRight size={14} className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
          {redirect.targetUrl || t('common.notFound')}
        </span>
      ),
    },
    {
      key: 'enabled',
      label: t('redirects.colEnabled', { defaultValue: 'Bật' }),
      render: enabledBadge,
    },
    {
      key: 'statusCode',
      label: t('redirects.colStatusCode', { defaultValue: 'Mã' }),
      render: statusCodeBadge,
    },
    {
      key: 'hitCount',
      label: t('redirects.colHits', { defaultValue: 'Lượt' }),
      align: 'right',
      render: (redirect) => redirect.hitCount ?? 0,
    },
    {
      key: 'updatedAt',
      label: t('redirects.colUpdated', { defaultValue: 'Cập nhật' }),
      render: (redirect) => <span className="text-xs text-muted-foreground">{formatDateTime(redirect.updatedAt)}</span>,
    },
    ...(canUpdate ? [{
      key: 'actions',
      label: <span className="sr-only">{t('common.actions')}</span>,
      align: 'right',
      render: rowActions,
    }] : []),
  ]

  // T7: cho phép ẩn/hiện cột trên bảng chuyển hướng, lưu theo trình duyệt (mirror Brand/Product/Customer/Category List).
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:redirects')

  const mobileCard = (redirect) => ({
    title: <span className="break-all font-mono text-sm">{redirect.sourcePattern || t('common.notFound')}</span>,
    selectionLabel: t('common.selectNamedRow', { name: redirect.sourcePattern }),
    subtitle: redirect.targetUrl,
    status: enabledBadge(redirect),
    meta: [
      { label: t('redirects.colStatusCode', { defaultValue: 'Mã' }), value: statusCodeBadge(redirect) },
      { label: t('redirects.colHits', { defaultValue: 'Lượt' }), value: redirect.hitCount ?? 0 },
      { label: t('redirects.colUpdated', { defaultValue: 'Cập nhật' }), value: formatDateTime(redirect.updatedAt) },
    ],
    actions: canUpdate ? rowActions(redirect) : undefined,
  })

  return (
    <Screen>
      <ScreenHeader
        group="content"
        title={t('redirects.title', { defaultValue: 'Chuyển hướng' })}
        help={t('redirects.description', { defaultValue: 'Quản lý địa chỉ cũ trên website: chuyển khách tới địa chỉ mới bằng 301 hoặc xác nhận địa chỉ đã gỡ bằng 410.' })}
        actions={canUpdate ? (
          <Button type="button" className="min-h-11" onClick={openCreateForm} disabled={isActionBusy}>
              <Plus size={14} />{t('redirects.createBtn', { defaultValue: 'Tạo chuyển hướng' })}
          </Button>
        ) : null}
      />

      {!canUpdate ? (
        <ReadOnlyBanner warning={t('redirects.readOnly', { defaultValue: 'Bạn chỉ có quyền xem chuyển hướng; mọi thao tác thay đổi đều bị khóa.' })} />
      ) : null}

      {/* Inline create/edit form */}
      {showForm && (
        <section className="rounded-md border border-border bg-surface" aria-labelledby="redirect-form-title">
          <div className="border-b border-border px-4 py-3">
            <h2 id="redirect-form-title" className="text-base font-semibold font-body">
              {editingRedirect
                ? t('redirects.editTitle', { defaultValue: 'Sửa chuyển hướng' })
                : t('redirects.createTitle', { defaultValue: 'Tạo chuyển hướng' })}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-4">
            {formError && <Alert tone="danger" size="sm" className="mb-3">{formError}</Alert>}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label={t('redirects.formSource', { defaultValue: 'Địa chỉ cũ' })}
                required
                helper={t('redirects.formSourceHint', { defaultValue: 'Đường dẫn nội bộ, ví dụ /san-pham-cu. Không nhập tên miền, query hoặc dấu #.' })}
                error={validationErrors.sourcePattern || (touched.sourcePattern ? sourceError : '')}
              >
                <Input
                  maxLength={1024}
                  value={form.sourcePattern}
                  onChange={(e) => updateFormField('sourcePattern', e.target.value)}
                  onBlur={() => markTouched('sourcePattern')}
                  placeholder="/dia-chi-cu"
                />
              </FormField>
              <FormField
                label={t('redirects.formTarget', { defaultValue: 'Địa chỉ mới' })}
                required
                helper={t('redirects.formTargetHint', { defaultValue: 'Đường dẫn mới trong website. Với mã 410, địa chỉ này chỉ để tham chiếu và khách sẽ không được chuyển tới đó.' })}
                error={validationErrors.targetUrl || (touched.targetUrl ? targetError : '')}
              >
                <Input
                  maxLength={2048}
                  value={form.targetUrl}
                  onChange={(e) => updateFormField('targetUrl', e.target.value)}
                  onBlur={() => markTouched('targetUrl')}
                  placeholder="/dia-chi-moi"
                />
              </FormField>
              <FormField
                label={t('redirects.formStatusCode', { defaultValue: 'Mã phản hồi' })}
                helper={t('redirects.formStatusCodeHint', { defaultValue: '301 đưa khách tới địa chỉ mới; 410 xác nhận địa chỉ đã bị gỡ và không có đích đến.' })}
              >
                <FilterSelect
                  value={String(form.statusCode)}
                  onValueChange={(value) => updateFormField('statusCode', Number(value) === 410 ? 410 : 301)}
                  ariaLabel={t('redirects.formStatusCode', { defaultValue: 'Mã phản hồi' })}
                  className="min-h-11 w-full"
                  options={[
                    { value: '301', label: t('redirects.status301', { defaultValue: '301 — Chuyển hướng' }) },
                    { value: '410', label: t('redirects.status410', { defaultValue: '410 — Đã gỡ' }) },
                  ]}
                />
              </FormField>
              {/* V2: bỏ marginTop:22 canh thủ công — dùng items-end trên chính field này để tự canh đáy với ô cạnh bên. */}
              <label
                className="flex min-h-11 w-fit cursor-pointer items-center gap-3 self-end rounded-sm border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                <Checkbox checked={form.enabled} onCheckedChange={(checked) => updateFormField('enabled', checked === true)} />
                <span>{t('redirects.formEnabled', { defaultValue: 'Bật' })}</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              <span className="text-danger" aria-hidden="true">*</span>{' '}
              {t('common.requiredLegend', { defaultValue: 'Bắt buộc' })}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" className="min-h-11" loading={saveMutation.isPending}>{t('common.save')}</Button>
              <Button type="button" className="min-h-11" variant="outline" onClick={confirmCloseForm} disabled={saveMutation.isPending}>{t('common.cancel')}</Button>
            </div>
          </form>
        </section>
      )}

      <ResponsiveFilterBar
        ariaLabel={t('redirects.filterAria', { defaultValue: 'Bộ lọc chuyển hướng' })}
        className="items-center"
        activeFilterCount={activeFilterChips.length}
        onReset={resetFilters}
      >
        <FilterSearchInput
          value={searchInput}
          onChange={(value) => setSearchInput(value.slice(0, 200))}
          placeholder={t('redirects.searchPlaceholder', { defaultValue: 'Địa chỉ cũ, địa chỉ mới' })}
          ariaLabel={t('redirects.searchPlaceholder', { defaultValue: 'Địa chỉ cũ, địa chỉ mới' })}
          wrapperClassName="min-w-48 flex-1"
          className="min-h-11"
          disabled={isActionBusy}
        />
        <FilterSelect
          value={query.enabled}
          onValueChange={(v) => updateQuery({ enabled: v }, { resetPage: true })}
          ariaLabel={t('redirects.filterEnabled', { defaultValue: 'Trạng thái' })}
          className="min-h-11"
          disabled={isActionBusy}
          options={[
            { value: 'ALL', label: t('redirects.filterEnabledAll', { defaultValue: 'Tất cả' }) },
            { value: 'true', label: t('redirects.statusOn', { defaultValue: 'Bật' }) },
            { value: 'false', label: t('redirects.statusOff', { defaultValue: 'Tắt' }) },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
          className="min-h-11"
          disabled={isActionBusy}
        />
        <ColumnVisibilityToggle className="min-h-11" allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={state.isFetching || isActionBusy}
          onClick={() => state.refetch()}
        >
          <RefreshCw size={16} className={state.isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
          {t('common.refresh', { defaultValue: 'Làm mới' })}
        </Button>
        {state.isFetching && state.status === 'success' ? (
          <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {t('redirects.refreshing', { defaultValue: 'Đang cập nhật' })}
          </span>
        ) : null}
      </ResponsiveFilterBar>

      <FilterChips
        chips={activeFilterChips}
        onClearAll={resetFilters}
        clearAllLabel={t('common.resetFilters')}
        removeChipLabel={t('common.clear')}
        ariaLabel={t('redirects.activeFiltersAria', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {/* O6: bật/tắt/xoá hàng loạt — mirror ContentListScreen/HomeVideoListScreen trong cùng module. */}
      {canUpdate ? (
        <BulkActionBar
          className="mt-4"
          selectedCount={selected.length}
          onClear={() => setSelected([])}
          actions={[
            { label: t('redirects.bulkEnable', { defaultValue: 'Bật' }), onClick: () => handleBulkSetEnabled(true), disabled: isActionBusy, loading: bulkBusy },
            { label: t('redirects.bulkDisable', { defaultValue: 'Tắt' }), onClick: () => handleBulkSetEnabled(false), disabled: isActionBusy, loading: bulkBusy },
            { label: t('common.delete'), onClick: handleBulkDelete, disabled: isActionBusy, loading: bulkBusy, tone: 'danger' },
          ]}
        />
      ) : null}

      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('redirects.errorTitle', { defaultValue: 'Không tải được chuyển hướng' })}
          description={state.error || t('common.error')}
          actionLabel={t('common.retry')}
          onAction={() => state.refetch()}
          className="mt-4"
        />
      )}

      {state.status === 'success' && items.length === 0 && (
        <StatePanel
          tone="neutral"
          title={isFiltered
            ? t('redirects.emptyFilteredTitle', { defaultValue: 'Không có chuyển hướng phù hợp' })
            : t('redirects.emptyTitle', { defaultValue: 'Chưa có chuyển hướng' })}
          description={isFiltered
            ? t('redirects.emptyFilteredDesc', { defaultValue: 'Hãy đổi từ khóa hoặc bộ lọc để xem kết quả khác.' })
            : t('redirects.emptyDesc', { defaultValue: 'Tạo chuyển hướng đầu tiên để bảo toàn các địa chỉ cũ.' })}
          actionLabel={isFiltered
            ? t('common.resetFilters')
            : canUpdate ? t('redirects.createBtn', { defaultValue: 'Tạo chuyển hướng' }) : undefined}
          onAction={isFiltered ? resetFilters : canUpdate ? openCreateForm : undefined}
          className="mt-4"
        />
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="mt-4 overflow-hidden rounded-md border border-border bg-surface">
          <AdminTable
            columns={visibleColumns}
            rows={items}
            caption={t('redirects.tableCaption', { defaultValue: 'Danh sách chuyển hướng' })}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
            mobileCard={mobileCard}
            selectable={canUpdate}
            selectedIds={selected}
            onSelectionChange={setSelected}
            rowClassName={(redirect) => enabledRowAccent(redirect.enabled)}
            densityKey="redirects"
          />
          {state.status === 'success' && pagination && (
            <div className="px-4">
            <PaginationControls
              pagination={pagination}
              disabled={state.isFetching || isActionBusy}
              onPageChange={(p) => updateQuery({ page: p })}
            />
            </div>
          )}
        </div>
      )}
    </Screen>
  )
}
