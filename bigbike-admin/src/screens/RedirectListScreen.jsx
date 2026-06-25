import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { FilterChips } from '../components/FilterChips'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  createRedirect,
  deleteRedirect,
  fetchRedirects,
  updateRedirect,
} from '../lib/adminApi'
import { PaginationControls } from '../components/PaginationControls'
import { AdminTable } from '../components/AdminTable'
import { FormField } from '../components/layout/FormField'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { formatDateTime } from '../lib/formatters'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const INITIAL_QUERY = {
  search: '',
  enabled: 'ALL',
  statusCode: 'ALL',
  page: 1,
  pageSize: 20,
}

const EMPTY_FORM = {
  sourcePattern: '',
  targetUrl: '',
  redirectType: 'PERMANENT',
  statusCode: '301',
  enabled: true,
  notes: '',
  legacyId: '',
}

const STATUS_CODE_LABELS = {
  301: '301 Permanent',
  302: '302 Temporary',
  307: '307 Temporary',
  308: '308 Permanent',
}

function normalizeRedirectTypeLabel(value, t) {
  const labels = {
    PERMANENT: t('redirects.typePermanent', { defaultValue: 'Permanent' }),
    TEMPORARY: t('redirects.typeTemporary', { defaultValue: 'Temporary' }),
    CUSTOM: t('redirects.typeCustom', { defaultValue: 'Custom' }),
  }
  return labels[value] || value || t('common.notFound')
}

export function RedirectListScreen({ canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isFirstSearchRender = useRef(true)
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 300)
  const [showForm, setShowForm] = useState(false)
  const [editingRedirect, setEditingRedirect] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [touched, setTouched] = useState({})
  const [formError, setFormError] = useState('')

  const queryKey = useMemo(
    () => ['redirects', query.search, query.enabled, query.statusCode, query.page, query.pageSize],
    [query.search, query.enabled, query.statusCode, query.page, query.pageSize],
  )

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchRedirects(query),
  })

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sourcePattern: form.sourcePattern.trim(),
        targetUrl: form.targetUrl.trim(),
        redirectType: form.redirectType,
        statusCode: Number(form.statusCode),
        enabled: form.enabled,
      }
      if (form.notes.trim()) {
        payload.notes = form.notes.trim()
      }
      if (form.legacyId !== '') {
        payload.legacyId = Number(form.legacyId)
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
          ? t('redirects.updateSuccess', { defaultValue: 'Redirect updated.' })
          : t('redirects.createSuccess', { defaultValue: 'Redirect created.' }),
      )
    },
    onError: (err) => setFormError(err?.message || t('common.error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (redirectId) => deleteRedirect(redirectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      toast.success(t('redirects.deleteSuccess', { defaultValue: 'Redirect deleted.' }))
    },
    onError: (err) => toast.error(err?.message || t('redirects.deleteError', { defaultValue: 'Failed to delete redirect.' })),
  })

  const items = data?.items ?? []
  const warning = ''

  const sourceError = !form.sourcePattern.trim()
    ? t('redirects.errorSourceRequired', { defaultValue: 'Source pattern is required.' })
    : ''
  const targetError = !form.targetUrl.trim()
    ? t('redirects.errorTargetRequired', { defaultValue: 'Target URL is required.' })
    : ''

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function openCreateForm() {
    setEditingRedirect(null)
    setForm({ ...EMPTY_FORM, statusCode: '301', redirectType: 'PERMANENT' })
    setTouched({})
    setFormError('')
    setShowForm(true)
  }

  function openEditForm(redirect) {
    setEditingRedirect(redirect)
    setForm({
      sourcePattern: redirect.sourcePattern || '',
      targetUrl: redirect.targetUrl || '',
      redirectType: redirect.redirectType || 'PERMANENT',
      statusCode: String(redirect.statusCode ?? 301),
      enabled: redirect.enabled !== false,
      notes: redirect.notes || '',
      legacyId: redirect.legacyId !== null && redirect.legacyId !== undefined ? String(redirect.legacyId) : '',
    })
    setTouched({})
    setFormError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingRedirect(null)
    setForm(EMPTY_FORM)
    setTouched({})
    setFormError('')
  }

  const handleDelete = useCallback(async (redirect) => {
    const confirmed = await showConfirm(
      t('redirects.deleteConfirm', {
        defaultValue: `Delete redirect "${redirect.sourcePattern}"?`,
        source: redirect.sourcePattern,
      }),
      t('redirects.deleteConfirmTitle', { defaultValue: 'Delete redirect' }),
    )
    if (!confirmed) return
    deleteMutation.mutate(redirect.id)
  }, [deleteMutation, t])

  function updateQuery(partial, { resetPage = false } = {}) {
    setQuery((prev) => {
      const next = { ...prev, ...partial }
      if (resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setQuery(INITIAL_QUERY)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (sourceError || targetError) {
      setTouched((prev) => ({ ...prev, sourcePattern: true, targetUrl: true }))
      setFormError(sourceError || targetError)
      return
    }
    setFormError('')
    saveMutation.mutate()
  }

  const pagination = data?.pagination

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
        value: query.enabled === 'true' ? t('common.on') : t('common.off'),
        defaultValue: `Bật: {{value}}`,
      }),
      removeLabel: t('redirects.removeFilter', { filter: t('redirects.filterEnabled', { defaultValue: 'Bật' }), defaultValue: `Bỏ lọc {{filter}}` }),
      onRemove: () => updateQuery({ enabled: 'ALL' }, { resetPage: true }),
    })
  }
  if (query.statusCode !== 'ALL') {
    activeFilterChips.push({
      key: 'statusCode',
      label: t('redirects.filterChipStatusCode', { value: query.statusCode, defaultValue: `Mã: {{value}}` }),
      removeLabel: t('redirects.removeFilter', { filter: t('redirects.filterStatusCode', { defaultValue: 'Mã trạng thái' }), defaultValue: `Bỏ lọc {{filter}}` }),
      onRemove: () => updateQuery({ statusCode: 'ALL' }, { resetPage: true }),
    })
  }

  const enabledBadge = (redirect) => (
    <span className={`bb-badge ${redirect.enabled !== false ? 'bb-badge-success' : 'bb-badge-neutral'}`}>
      {redirect.enabled !== false ? t('common.on') : t('common.off')}
    </span>
  )

  const rowActions = (redirect) => (
    <>
      <button
        type="button"
        className="bb-icon-btn"
        title={t('common.edit')}
        aria-label={t('common.edit')}
        onClick={() => openEditForm(redirect)}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        className="bb-icon-btn"
        title={t('common.delete')}
        aria-label={t('common.delete')}
        onClick={() => handleDelete(redirect)}
      >
        <Trash2 size={14} />
      </button>
    </>
  )

  const columns = [
    {
      key: 'sourcePattern',
      label: t('redirects.colSource', { defaultValue: 'Nguồn' }),
      render: (redirect) => <span className="mono" style={{ wordBreak: 'break-all' }}>{redirect.sourcePattern}</span>,
    },
    {
      key: 'targetUrl',
      label: t('redirects.colTarget', { defaultValue: 'Đích' }),
      render: (redirect) => (
        <span style={{ wordBreak: 'break-all' }}>
          <ExternalLink size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
          {redirect.targetUrl}
        </span>
      ),
    },
    {
      key: 'redirectType',
      label: t('redirects.colType', { defaultValue: 'Loại' }),
      render: (redirect) => normalizeRedirectTypeLabel(redirect.redirectType, t),
    },
    {
      key: 'statusCode',
      label: t('redirects.colStatusCode', { defaultValue: 'Trạng thái' }),
      render: (redirect) => STATUS_CODE_LABELS[redirect.statusCode] || String(redirect.statusCode || ''),
    },
    {
      key: 'enabled',
      label: t('redirects.colEnabled', { defaultValue: 'Bật' }),
      render: enabledBadge,
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
      render: (redirect) => <span className="bb-muted" style={{ fontSize: 12 }}>{formatDateTime(redirect.updatedAt)}</span>,
    },
    ...(canUpdate ? [{
      key: 'actions',
      label: '',
      align: 'right',
      render: (redirect) => <span className="col-actions">{rowActions(redirect)}</span>,
    }] : []),
  ]

  const mobileCard = (redirect) => ({
    title: <span className="mono" style={{ wordBreak: 'break-all' }}>{redirect.sourcePattern}</span>,
    subtitle: redirect.targetUrl,
    status: enabledBadge(redirect),
    meta: [
      { label: t('redirects.colType', { defaultValue: 'Loại' }), value: normalizeRedirectTypeLabel(redirect.redirectType, t) },
      { label: t('redirects.colStatusCode', { defaultValue: 'Trạng thái' }), value: STATUS_CODE_LABELS[redirect.statusCode] || String(redirect.statusCode || '') },
      { label: t('redirects.colHits', { defaultValue: 'Lượt' }), value: redirect.hitCount ?? 0 },
      { label: t('redirects.colUpdated', { defaultValue: 'Cập nhật' }), value: formatDateTime(redirect.updatedAt) },
    ],
    actions: canUpdate ? rowActions(redirect) : undefined,
  })

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('nav.redirects', { defaultValue: 'Chuyển hướng' })}</p>
          <h1>{t('redirects.title', { defaultValue: 'Chuyển hướng' })}</h1>
          <p className="bb-muted">{t('redirects.description', { defaultValue: 'Quản lý chuyển hướng SEO và ánh xạ URL cũ.' })}</p>
        </div>
        {canUpdate && (
          <div className="bb-screen-actions">
            <button type="button" className="bb-btn bb-btn-primary" onClick={openCreateForm}>
              <Plus size={14} />{t('redirects.createBtn', { defaultValue: 'Tạo chuyển hướng' })}
            </button>
          </div>
        )}
      </div>

      {warning ? <ReadOnlyBanner warning={warning} /> : null}

      {/* Inline create/edit form */}
      {showForm && (
        <div className="bb-card mb-4">
          <div className="bb-card-header">
            <h2>
              {editingRedirect
                ? t('redirects.editTitle', { defaultValue: 'Sửa chuyển hướng' })
                : t('redirects.createTitle', { defaultValue: 'Tạo chuyển hướng' })}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="bb-card-body">
            {formError && <Alert tone="danger" size="sm" className="mb-3">{formError}</Alert>}
            <div className="bb-grid-2">
              <FormField
                label={t('redirects.formSource', { defaultValue: 'Mẫu nguồn' })}
                required
                error={touched.sourcePattern ? sourceError : ''}
              >
                <Input
                  value={form.sourcePattern}
                  onChange={(e) => setForm((p) => ({ ...p, sourcePattern: e.target.value }))}
                  onBlur={() => markTouched('sourcePattern')}
                  placeholder="/old-url"
                />
              </FormField>
              <FormField
                label={t('redirects.formTarget', { defaultValue: 'URL đích' })}
                required
                error={touched.targetUrl ? targetError : ''}
              >
                <Input
                  value={form.targetUrl}
                  onChange={(e) => setForm((p) => ({ ...p, targetUrl: e.target.value }))}
                  onBlur={() => markTouched('targetUrl')}
                  placeholder="/new-url"
                />
              </FormField>
              <label className="form-field">
                <span>{t('redirects.formType', { defaultValue: 'Loại chuyển hướng' })}</span>
                <Select value={form.redirectType} onValueChange={(val) => setForm((p) => ({ ...p, redirectType: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERMANENT">Permanent</SelectItem>
                    <SelectItem value="TEMPORARY">Temporary</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="form-field">
                <span>{t('redirects.formStatusCode', { defaultValue: 'Mã trạng thái' })}</span>
                <Select value={form.statusCode} onValueChange={(val) => setForm((p) => ({ ...p, statusCode: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="301">301 Permanent</SelectItem>
                    <SelectItem value="302">302 Temporary</SelectItem>
                    <SelectItem value="307">307 Temporary</SelectItem>
                    <SelectItem value="308">308 Permanent</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="form-field">
                <span>{t('redirects.formLegacyId', { defaultValue: 'Legacy ID' })}</span>
                <Input type="number" min="0" value={form.legacyId} onChange={(e) => setForm((p) => ({ ...p, legacyId: e.target.value }))} />
              </label>
              <label
                className="flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit"
                style={{ marginTop: 22 }}
              >
                <Checkbox checked={form.enabled} onCheckedChange={(checked) => setForm((p) => ({ ...p, enabled: checked === true }))} />
                <span>{t('redirects.formEnabled', { defaultValue: 'Bật' })}</span>
              </label>
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('redirects.formNotes', { defaultValue: 'Ghi chú' })}</span>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder={t('redirects.notesPlaceholder', { defaultValue: 'Ghi chú tuỳ chọn.' })} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              <span className="text-danger" aria-hidden="true">*</span>{' '}
              {t('common.requiredLegend', { defaultValue: 'Bắt buộc' })}
            </p>
            <div className="mt-4 flex gap-2">
              <Button type="submit" loading={saveMutation.isPending}>{t('common.save')}</Button>
              <Button type="button" variant="outline" onClick={closeForm} disabled={saveMutation.isPending}>{t('common.cancel')}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('redirects.searchPlaceholder', { defaultValue: 'Nguồn, đích, ghi chú, legacy ID' })}
          ariaLabel={t('redirects.searchPlaceholder', { defaultValue: 'Nguồn, đích, ghi chú, legacy ID' })}
        />
        <FilterSelect
          value={query.enabled}
          onValueChange={(v) => updateQuery({ enabled: v }, { resetPage: true })}
          ariaLabel={t('redirects.filterEnabled', { defaultValue: 'Bật' })}
          options={[
            { value: 'ALL', label: t('redirects.filterEnabled', { defaultValue: 'Bật' }) },
            { value: 'true', label: t('common.on') },
            { value: 'false', label: t('common.off') },
          ]}
        />
        <FilterSelect
          value={query.statusCode}
          onValueChange={(v) => updateQuery({ statusCode: v }, { resetPage: true })}
          ariaLabel={t('redirects.filterStatusCode', { defaultValue: 'Mã trạng thái' })}
          options={[
            { value: 'ALL', label: t('redirects.filterStatusCode', { defaultValue: 'Mã trạng thái' }) },
            { value: '301', label: '301' },
            { value: '302', label: '302' },
            { value: '307', label: '307' },
            { value: '308', label: '308' },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
        />
      </div>

      <FilterChips
        chips={activeFilterChips}
        onClearAll={resetFilters}
        clearAllLabel={t('common.resetFilters')}
        removeChipLabel={t('common.clear')}
        ariaLabel={t('redirects.activeFiltersAria', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {isError && (
        <StatePanel
          tone="danger"
          title={t('redirects.errorTitle', { defaultValue: 'Không tải được chuyển hướng' })}
          description={error?.message || t('common.error')}
          actionLabel={t('common.retry')}
          onAction={() => queryClient.invalidateQueries({ queryKey: ['redirects'] })}
        />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <StatePanel
          tone="neutral"
          title={t('redirects.emptyTitle', { defaultValue: 'Không có chuyển hướng' })}
          description={t('redirects.emptyDesc', { defaultValue: 'Đổi bộ lọc hoặc tạo chuyển hướng mới.' })}
          actionLabel={canUpdate ? t('redirects.createBtn', { defaultValue: 'Tạo chuyển hướng' }) : t('common.resetFilters')}
          onAction={canUpdate ? openCreateForm : resetFilters}
        />
      )}

      {(isLoading || items.length > 0) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <AdminTable
              columns={columns}
              rows={items}
              loading={isLoading && items.length === 0}
              pageSize={query.pageSize}
              mobileCard={mobileCard}
            />
          </div>
          {pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={(p) => updateQuery({ page: p })}
            />
          )}
        </div>
      )}
    </div>
  )
}
