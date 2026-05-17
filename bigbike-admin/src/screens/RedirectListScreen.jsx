import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  createRedirect,
  deleteRedirect,
  fetchRedirects,
  updateRedirect,
} from '../lib/adminApi'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { useDebounce } from '../lib/useDebounce'
import { formatDateTime } from '../lib/formatters'
import { Badge } from '@/components/ui/badge'
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
  const warning = data?.mode === 'mock'
    ? (data?.warning || t('redirects.mockWarning', { defaultValue: 'Showing mock redirect data.' }))
    : ''

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

  const columns = useMemo(() => [
    {
      key: 'sourcePattern',
      label: t('redirects.colSource', { defaultValue: 'Source' }),
      render: (redirect) => (
        <code className="text-xs font-bold break-all">
          {redirect.sourcePattern}
        </code>
      ),
    },
    {
      key: 'targetUrl',
      label: t('redirects.colTarget', { defaultValue: 'Target' }),
      render: (redirect) => (
        <span className="break-all">
          <ExternalLink size={12} className="mr-1 align-text-bottom" />
          {redirect.targetUrl}
        </span>
      ),
    },
    {
      key: 'redirectType',
      label: t('redirects.colType', { defaultValue: 'Type' }),
      render: (redirect) => normalizeRedirectTypeLabel(redirect.redirectType, t),
    },
    {
      key: 'statusCode',
      label: t('redirects.colStatusCode', { defaultValue: 'Status' }),
      render: (redirect) => STATUS_CODE_LABELS[redirect.statusCode] || String(redirect.statusCode || ''),
    },
    {
      key: 'enabled',
      label: t('redirects.colEnabled', { defaultValue: 'Enabled' }),
      render: (redirect) => (
        <Badge variant={redirect.enabled !== false ? 'success' : 'muted'}>
          {redirect.enabled !== false ? t('common.on') : t('common.off')}
        </Badge>
      ),
    },
    {
      key: 'hitCount',
      label: t('redirects.colHits', { defaultValue: 'Hits' }),
      render: (redirect) => String(redirect.hitCount ?? 0),
      align: 'right',
    },
    {
      key: 'updatedAt',
      label: t('redirects.colUpdated', { defaultValue: 'Updated' }),
      render: (redirect) => formatDateTime(redirect.updatedAt),
    },
    canUpdate ? {
      key: 'actions',
      label: '',
      align: 'right',
      render: (redirect) => (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => openEditForm(redirect)}>
            <Pencil size={14} />
            {t('common.edit')}
          </Button>
          <Button variant="danger" onClick={() => handleDelete(redirect)}>
            <Trash2 size={14} />
            {t('common.delete')}
          </Button>
        </div>
      ),
    } : null,
  ].filter(Boolean), [canUpdate, handleDelete, t])

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

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('nav.redirects', { defaultValue: 'Redirects' })}</p>
          <h1>{t('redirects.title', { defaultValue: 'Redirects' })}</h1>
          <p>{t('redirects.description', { defaultValue: 'Manage SEO migration redirects and legacy URL mappings.' })}</p>
        </div>
        {canUpdate && (
          <Button onClick={openCreateForm}>
            <Plus size={16} />
            {t('redirects.createBtn', { defaultValue: 'Create redirect' })}
          </Button>
        )}
      </header>

      {warning ? <ReadOnlyBanner warning={warning} /> : null}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-md border border-border bg-surface p-4 mb-4 shadow-xs"
        >
          <h3 className="mb-3">
            {editingRedirect
              ? t('redirects.editTitle', { defaultValue: 'Edit redirect' })
              : t('redirects.createTitle', { defaultValue: 'Create redirect' })}
          </h3>
          {formError && <p className="inline-error">{formError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <label>
              {t('redirects.formSource', { defaultValue: 'Source pattern' })}
              <Input
                value={form.sourcePattern}
                onChange={(e) => setForm((prev) => ({ ...prev, sourcePattern: e.target.value }))}
                placeholder="/old-url"
               />
            </label>
            <label>
              {t('redirects.formTarget', { defaultValue: 'Target URL' })}
              <Input
                value={form.targetUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, targetUrl: e.target.value }))}
                placeholder="/new-url"
               />
            </label>
            <label>
              {t('redirects.formType', { defaultValue: 'Redirect type' })}
              <Select
                value={form.redirectType}
                onValueChange={(val) => setForm((prev) => ({ ...prev, redirectType: val }))}
              ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="PERMANENT">Permanent</SelectItem>
                <SelectItem value="TEMPORARY">Temporary</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent></Select>
            </label>
            <label>
              {t('redirects.formStatusCode', { defaultValue: 'Status code' })}
              <Select
                value={form.statusCode}
                onValueChange={(val) => setForm((prev) => ({ ...prev, statusCode: val }))}
              ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="301">301 Permanent</SelectItem>
                <SelectItem value="302">302 Temporary</SelectItem>
                <SelectItem value="307">307 Temporary</SelectItem>
                <SelectItem value="308">308 Permanent</SelectItem>
              </SelectContent></Select>
            </label>
            <label>
              {t('redirects.formLegacyId', { defaultValue: 'Legacy ID' })}
              <Input
                type="number"
                min="0"
                value={form.legacyId}
                onChange={(e) => setForm((prev) => ({ ...prev, legacyId: e.target.value }))}
               />
            </label>
            <label className="flex items-center gap-2 mt-6">
              <Checkbox
                checked={form.enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
               />
              {t('redirects.formEnabled', { defaultValue: 'Enabled' })}
            </label>
            <label className="col-span-full">
              {t('redirects.formNotes', { defaultValue: 'Notes' })}
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={t('redirects.notesPlaceholder', { defaultValue: 'Optional notes for SEO migration or content review.' })}
               />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" loading={saveMutation.isPending}>
              {t('common.save')}
            </Button>
            <Button variant="outline" onClick={closeForm} disabled={saveMutation.isPending}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('redirects.searchPlaceholder', { defaultValue: 'Source, target, notes, legacy ID' })}
           />
        </label>
        <label>
          {t('redirects.filterEnabled', { defaultValue: 'Enabled' })}
          <Select
            value={query.enabled}
            onValueChange={(val) => updateQuery({ enabled: val }, { resetPage: true })}
          ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">{t('common.all')}</SelectItem>
            <SelectItem value="true">{t('common.on')}</SelectItem>
            <SelectItem value="false">{t('common.off')}</SelectItem>
          </SelectContent></Select>
        </label>
        <label>
          {t('redirects.filterStatusCode', { defaultValue: 'Status code' })}
          <Select
            value={query.statusCode}
            onValueChange={(val) => updateQuery({ statusCode: val }, { resetPage: true })}
          ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">{t('common.all')}</SelectItem>
            <SelectItem value="301">301</SelectItem>
            <SelectItem value="302">302</SelectItem>
            <SelectItem value="307">307</SelectItem>
            <SelectItem value="308">308</SelectItem>
          </SelectContent></Select>
        </label>
      </section>

      {isError && (
        <StatePanel
          tone="danger"
          title={t('redirects.errorTitle', { defaultValue: 'Could not load redirects' })}
          description={error?.message || t('common.error')}
          actionLabel={t('common.retry')}
          onAction={() => queryClient.invalidateQueries({ queryKey: ['redirects'] })}
        />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <StatePanel
          tone="neutral"
          title={t('redirects.emptyTitle', { defaultValue: 'No redirects found' })}
          description={t('redirects.emptyDesc', { defaultValue: 'Try changing the filters or create a new redirect.' })}
          actionLabel={canUpdate ? t('redirects.createBtn', { defaultValue: 'Create redirect' }) : t('common.resetFilters')}
          onAction={canUpdate ? openCreateForm : () => setQuery(INITIAL_QUERY)}
        />
      )}

      {items.length > 0 && (
        <>
          <AdminTable
            caption={t('redirects.tableCaption', { defaultValue: 'Redirects' })}
            columns={columns}
            rows={items}
            loading={isLoading}
            pageSize={query.pageSize}
          />
          <PaginationControls
            pagination={data?.pagination}
            onPageChange={(page) => updateQuery({ page })}
          />
        </>
      )}
    </section>
  )
}
