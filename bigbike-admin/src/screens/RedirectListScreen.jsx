import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createRedirect,
  deleteRedirect,
  fetchRedirects,
  updateRedirect,
} from '../lib/adminApi'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { useDebounce } from '../lib/useDebounce'
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
  pageSize: 10,
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
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState(INITIAL_QUERY.search)
  const debouncedSearch = useDebounce(searchInput, 250)
  const [showForm, setShowForm] = useState(false)
  const [editingRedirect, setEditingRedirect] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
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

  function openCreateForm() {
    setEditingRedirect(null)
    setForm({ ...EMPTY_FORM, statusCode: '301', redirectType: 'PERMANENT' })
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
    setFormError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingRedirect(null)
    setForm(EMPTY_FORM)
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

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.sourcePattern.trim()) {
      setFormError(t('redirects.errorSourceRequired', { defaultValue: 'Source pattern is required.' }))
      return
    }
    if (!form.targetUrl.trim()) {
      setFormError(t('redirects.errorTargetRequired', { defaultValue: 'Target URL is required.' }))
      return
    }
    setFormError('')
    saveMutation.mutate()
  }

  const pagination = data?.pagination

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
            <div className="grid-2">
              <label className="form-field">
                <span>{t('redirects.formSource', { defaultValue: 'Mẫu nguồn' })}</span>
                <Input value={form.sourcePattern} onChange={(e) => setForm((p) => ({ ...p, sourcePattern: e.target.value }))} placeholder="/old-url" />
              </label>
              <label className="form-field">
                <span>{t('redirects.formTarget', { defaultValue: 'URL đích' })}</span>
                <Input value={form.targetUrl} onChange={(e) => setForm((p) => ({ ...p, targetUrl: e.target.value }))} placeholder="/new-url" />
              </label>
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
            <div className="mt-4 flex gap-2">
              <Button type="submit" loading={saveMutation.isPending}>{t('common.save')}</Button>
              <Button type="button" variant="outline" onClick={closeForm} disabled={saveMutation.isPending}>{t('common.cancel')}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bb-filter-bar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--bb-text-muted)', pointerEvents: 'none' }} />
          <input
            type="search"
            className="bb-input"
            style={{ paddingLeft: 28 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('redirects.searchPlaceholder', { defaultValue: 'Nguồn, đích, ghi chú, legacy ID' })}
          />
        </div>
        <select
          className="bb-select"
          value={query.enabled}
          onChange={(e) => updateQuery({ enabled: e.target.value }, { resetPage: true })}
          aria-label={t('redirects.filterEnabled', { defaultValue: 'Bật' })}
        >
          <option value="ALL">{t('redirects.filterEnabled', { defaultValue: 'Bật' })}</option>
          <option value="true">{t('common.on')}</option>
          <option value="false">{t('common.off')}</option>
        </select>
        <select
          className="bb-select"
          value={query.statusCode}
          onChange={(e) => updateQuery({ statusCode: e.target.value }, { resetPage: true })}
          aria-label={t('redirects.filterStatusCode', { defaultValue: 'Mã trạng thái' })}
        >
          <option value="ALL">{t('redirects.filterStatusCode', { defaultValue: 'Mã trạng thái' })}</option>
          <option value="301">301</option>
          <option value="302">302</option>
          <option value="307">307</option>
          <option value="308">308</option>
        </select>
      </div>

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
          onAction={canUpdate ? openCreateForm : () => setQuery(INITIAL_QUERY)}
        />
      )}

      {(isLoading || items.length > 0) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>{t('redirects.colSource', { defaultValue: 'Nguồn' })}</th>
                    <th>{t('redirects.colTarget', { defaultValue: 'Đích' })}</th>
                    <th>{t('redirects.colType', { defaultValue: 'Loại' })}</th>
                    <th>{t('redirects.colStatusCode', { defaultValue: 'Trạng thái' })}</th>
                    <th>{t('redirects.colEnabled', { defaultValue: 'Bật' })}</th>
                    <th className="num">{t('redirects.colHits', { defaultValue: 'Lượt' })}</th>
                    <th>{t('redirects.colUpdated', { defaultValue: 'Cập nhật' })}</th>
                    {canUpdate && <th />}
                  </tr>
                </thead>
                <tbody>
                  {isLoading && items.length === 0 && (
                    [...Array(6)].map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={canUpdate ? 8 : 7}><div className="dash-skeleton-block" style={{ height: 28 }} /></td>
                      </tr>
                    ))
                  )}
                  {items.map((redirect) => (
                    <tr key={redirect.id}>
                      <td className="mono" style={{ wordBreak: 'break-all' }}>{redirect.sourcePattern}</td>
                      <td style={{ wordBreak: 'break-all' }}>
                        <ExternalLink size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
                        {redirect.targetUrl}
                      </td>
                      <td>{normalizeRedirectTypeLabel(redirect.redirectType, t)}</td>
                      <td>{STATUS_CODE_LABELS[redirect.statusCode] || String(redirect.statusCode || '')}</td>
                      <td>
                        <span className={`bb-badge ${redirect.enabled !== false ? 'bb-badge-success' : 'bb-badge-neutral'}`}>
                          {redirect.enabled !== false ? t('common.on') : t('common.off')}
                        </span>
                      </td>
                      <td className="num">{redirect.hitCount ?? 0}</td>
                      <td className="bb-muted" style={{ fontSize: 12 }}>{formatDateTime(redirect.updatedAt)}</td>
                      {canUpdate && (
                        <td className="col-actions">
                          <button type="button" className="bb-icon-btn" title={t('common.edit')} onClick={() => openEditForm(redirect)}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" className="bb-icon-btn" title={t('common.delete')} onClick={() => handleDelete(redirect)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
