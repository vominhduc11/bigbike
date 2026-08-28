import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Pencil, Plus, RefreshCw } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { AdminTable } from '@/components/AdminTable'
import { TableRowActions } from '@/components/TableRowActions'
import { ColumnVisibilityToggle } from '@/components/ColumnVisibilityToggle'
import { FilterSearchInput } from '@/components/FilterSearchInput'
import { FilterSelect } from '@/components/FilterSelect'
import { PaginationControls } from '@/components/PaginationControls'
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'
import { StatePanel } from '@/components/StatePanel'
import { FormField, ResponsiveFilterBar, Screen, ScreenHeader } from '@/components/layout'
import {
  createLegacyDiscontinuedProduct,
  fetchLegacyDiscontinuedProducts,
  updateLegacyDiscontinuedProduct,
} from '@/lib/adminApi'
import { formatDateTime } from '@/lib/formatters'
import { useAdminList } from '@/lib/useAdminList'
import { useDebounce } from '@/lib/useDebounce'
import { useColumnVisibility } from '@/lib/useColumnVisibility'
import { enabledRowAccent } from '@/lib/statusTone'

const INITIAL_QUERY = { search: '', enabled: 'ALL', page: 1, pageSize: 20 }
const EMPTY_FORM = {
  slug: '', name: '', nameEn: '', brandName: '', categorySlug: '', imageUrl: '', enabled: true,
}

function enabledBadge(enabled, t) {
  return enabled
    ? <span className="inline-flex items-center gap-2 text-sm text-success"><span className="h-2 w-2 rounded-full bg-success" />{t('legacyDiscontinued.statusVisible')}</span>
    : <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><span className="h-2 w-2 rounded-full bg-muted-foreground" />{t('legacyDiscontinued.statusOff')}</span>
}

export function LegacyDiscontinuedProductsScreen({ canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)
  const firstSearch = useRef(true)
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')

  const state = useAdminList(
    ['legacy-discontinued-products', query.search, query.enabled, query.page, query.pageSize],
    () => fetchLegacyDiscontinuedProducts(query),
  )

  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false
      return
    }
    setQuery((previous) => ({ ...previous, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    if (state.status !== 'success' || !state.pagination) return
    if (query.page <= Math.max(1, state.pagination.totalPages || 1)) return
    const timer = window.setTimeout(() => setQuery((previous) => ({ ...previous, page: 1 })), 0)
    return () => window.clearTimeout(timer)
  }, [query.page, state.pagination, state.status])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        nameEn: form.nameEn.trim() || null,
        brandName: form.brandName.trim() || null,
        categorySlug: form.categorySlug.trim(),
        imageUrl: form.imageUrl.trim() || null,
        enabled: form.enabled,
      }
      return editing
        ? updateLegacyDiscontinuedProduct(editing.id, payload)
        : createLegacyDiscontinuedProduct(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legacy-discontinued-products'] })
      closeForm()
      toast.success(t(editing ? 'legacyDiscontinued.updateSuccess' : 'legacyDiscontinued.createSuccess'))
    },
    onError: (error) => setFormError(error?.message || t('legacyDiscontinued.saveError')),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }) => updateLegacyDiscontinuedProduct(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legacy-discontinued-products'] })
      toast.success(t('legacyDiscontinued.toggleSuccess'))
    },
    onError: (error) => toast.error(error?.message || t('legacyDiscontinued.toggleError')),
  })
  const { mutate: toggleProduct, isPending: isTogglePending } = toggleMutation

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function openCreate() {
    setFormOpen(true)
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function openEdit(item) {
    setFormOpen(true)
    setEditing(item)
    setForm({
      slug: item.slug || '', name: item.name || '', nameEn: item.nameEn || '', brandName: item.brandName || '',
      categorySlug: item.categorySlug || '', imageUrl: item.imageUrl || '', enabled: item.enabled !== false,
    })
    setFormError('')
  }

  function resetFilters() {
    setSearchInput('')
    setQuery((previous) => ({ ...previous, search: '', enabled: 'ALL', page: 1 }))
  }

  function changeForm(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setFormError('')
  }

  function submit(event) {
    event.preventDefault()
    if (!canUpdate || saveMutation.isPending) return
    if (!form.slug.trim() || !form.name.trim() || !form.categorySlug.trim()) {
      setFormError(t('legacyDiscontinued.requiredError'))
      return
    }
    saveMutation.mutate()
  }

  const columns = useMemo(() => [
    {
      key: 'name', label: t('legacyDiscontinued.colItem'),
      render: (item) => <div className="min-w-0"><p className="m-0 font-medium text-foreground">{item.name || t('legacyDiscontinued.unnamed')}</p><p className="m-0 mt-1 break-all font-mono text-xs text-muted-foreground">/sp/{item.slug}.html</p></div>,
    },
    { key: 'categorySlug', label: t('legacyDiscontinued.colCategory'), render: (item) => <span className="font-mono text-sm">{item.categorySlug}</span> },
    { key: 'imageUrl', label: t('legacyDiscontinued.colImage'), render: (item) => item.imageUrl ? <span className="text-sm text-success">{t('legacyDiscontinued.hasImage')}</span> : <span className="text-sm text-warning">{t('legacyDiscontinued.noImage')}</span> },
    { key: 'enabled', label: t('legacyDiscontinued.colStatus'), render: (item) => enabledBadge(item.enabled, t) },
    { key: 'updatedAt', label: t('legacyDiscontinued.colUpdated'), render: (item) => <span className="text-xs text-muted-foreground">{formatDateTime(item.updatedAt)}</span> },
    ...(canUpdate ? [{
      key: 'actions', label: <span className="sr-only">{t('common.actions')}</span>, align: 'right',
      render: (item) => <TableRowActions
        primaryActions={[
          {
            key: 'edit',
            label: t('common.edit'),
            ariaLabel: t('legacyDiscontinued.editNamed', { name: item.name || t('legacyDiscontinued.unnamed') }),
            icon: Pencil,
            onSelect: () => openEdit(item),
          },
          {
            key: 'toggle',
            label: t(item.enabled ? 'legacyDiscontinued.disable' : 'legacyDiscontinued.enable'),
            icon: item.enabled ? EyeOff : Eye,
            disabled: isTogglePending,
            onSelect: () => toggleProduct({ id: item.id, enabled: !item.enabled }),
          },
        ]}
      />,
    }] : []),
  ], [canUpdate, isTogglePending, t, toggleProduct])
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:legacy-discontinued')

  if (state.status === 'error') {
    return <Screen><StatePanel tone="danger" title={t('legacyDiscontinued.loadError')} description={state.error} actionLabel={t('common.retry')} onAction={() => state.refetch()} /></Screen>
  }

  return (
    <Screen>
      <ScreenHeader
        group="products"
        title={t('legacyDiscontinued.title')}
        help={t('legacyDiscontinued.help')}
        actions={canUpdate ? <Button className="min-h-11" onClick={openCreate} disabled={saveMutation.isPending}><Plus size={16} />{t('legacyDiscontinued.create')}</Button> : null}
      />

      {!canUpdate ? <ReadOnlyBanner warning={t('legacyDiscontinued.readOnly')} /> : null}

      {formOpen ? (
        <section className="rounded-md border border-border bg-surface" aria-labelledby="legacy-history-form-title">
          <div className="border-b border-border px-4 py-3"><h2 id="legacy-history-form-title" className="m-0 text-base font-semibold">{t(editing ? 'legacyDiscontinued.editTitle' : 'legacyDiscontinued.createTitle')}</h2></div>
          <form onSubmit={submit} className="p-4">
            {formError ? <Alert tone="danger" size="sm" className="mb-4">{formError}</Alert> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label={t('legacyDiscontinued.slugLabel')} required helper={t('legacyDiscontinued.slugHelp')}>
                <Input value={form.slug} maxLength={255} onChange={(event) => changeForm('slug', event.target.value)} placeholder="gang-tay-cu" disabled={!canUpdate} />
              </FormField>
              <FormField label={t('legacyDiscontinued.nameLabel')} required>
                <Input value={form.name} maxLength={255} onChange={(event) => changeForm('name', event.target.value)} placeholder={t('legacyDiscontinued.namePlaceholder')} disabled={!canUpdate} />
              </FormField>
              <FormField label={t('legacyDiscontinued.nameEnLabel')} helper={t('legacyDiscontinued.nameEnHelp')}>
                <Input value={form.nameEn} maxLength={255} onChange={(event) => changeForm('nameEn', event.target.value)} placeholder={t('legacyDiscontinued.nameEnPlaceholder')} disabled={!canUpdate} />
              </FormField>
              <FormField label={t('legacyDiscontinued.brandLabel')}>
                <Input value={form.brandName} maxLength={255} onChange={(event) => changeForm('brandName', event.target.value)} placeholder={t('legacyDiscontinued.optional')} disabled={!canUpdate} />
              </FormField>
              <FormField label={t('legacyDiscontinued.categorySlugLabel')} required helper={t('legacyDiscontinued.categorySlugHelp')}>
                <Input value={form.categorySlug} maxLength={255} onChange={(event) => changeForm('categorySlug', event.target.value)} placeholder="gang-tay-xe-may-moto" disabled={!canUpdate} />
              </FormField>
              <FormField label={t('legacyDiscontinued.imageUrlLabel')} helper={t('legacyDiscontinued.imageUrlHelp')}>
                <Input value={form.imageUrl} maxLength={2048} onChange={(event) => changeForm('imageUrl', event.target.value)} placeholder="/media/uploads/..." disabled={!canUpdate} />
              </FormField>
              <div className="flex items-center gap-3 md:col-span-2">
                <Checkbox checked={form.enabled} onCheckedChange={(checked) => changeForm('enabled', checked === true)} disabled={!canUpdate} id="legacy-enabled" />
                <label htmlFor="legacy-enabled" className="text-sm font-medium text-foreground">{t('legacyDiscontinued.enabledLabel')}</label>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="secondary" className="min-h-11" onClick={closeForm} disabled={saveMutation.isPending}>{t('common.cancel')}</Button>
              <Button type="submit" className="min-h-11" disabled={!canUpdate || saveMutation.isPending}>{saveMutation.isPending ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        </section>
      ) : null}

      <ResponsiveFilterBar
        ariaLabel={t('legacyDiscontinued.filterAria')}
        activeFilterCount={Number(Boolean(query.search)) + Number(query.enabled !== 'ALL')}
        onReset={resetFilters}
      >
        <FilterSearchInput value={searchInput} onChange={setSearchInput} placeholder={t('legacyDiscontinued.searchPlaceholder')} wrapperClassName="min-w-64 flex-1" />
        <FilterSelect value={query.enabled} onValueChange={(enabled) => setQuery((previous) => ({ ...previous, enabled, page: 1 }))} ariaLabel={t('legacyDiscontinued.colStatus')} options={[{ value: 'ALL', label: t('legacyDiscontinued.allStatuses') }, { value: 'true', label: t('legacyDiscontinued.statusVisible') }, { value: 'false', label: t('legacyDiscontinued.statusOff') }]} />
        <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
        <Button type="button" variant="secondary" className="min-h-11" onClick={() => state.refetch()} disabled={state.isFetching}><RefreshCw size={16} className={state.isFetching ? 'animate-spin' : ''} />{t('common.refresh')}</Button>
      </ResponsiveFilterBar>

      {state.status === 'success' && state.items.length === 0 ? (
        <StatePanel tone="neutral" title={t('legacyDiscontinued.emptyTitle')} description={t('legacyDiscontinued.emptyDescription')} actionLabel={canUpdate ? t('legacyDiscontinued.create') : undefined} onAction={canUpdate ? openCreate : undefined} />
      ) : (
        <AdminTable
          columns={visibleColumns}
          rows={state.items}
          loading={state.status === 'loading'}
          pageSize={query.pageSize}
          caption={t('legacyDiscontinued.tableCaption')}
          densityKey="legacy-discontinued"
          rowClassName={(item) => enabledRowAccent(item.enabled)}
          onRowClick={canUpdate ? openEdit : undefined}
          mobileCard={(item) => ({
            title: item.name || t('legacyDiscontinued.unnamed'),
            subtitle: `/sp/${item.slug}.html`,
            status: enabledBadge(item.enabled, t),
            meta: [
              { label: t('legacyDiscontinued.colCategory'), value: item.categorySlug || '—' },
              { label: t('legacyDiscontinued.colImage'), value: t(item.imageUrl ? 'legacyDiscontinued.hasImage' : 'legacyDiscontinued.noImage') },
              { label: t('legacyDiscontinued.colUpdated'), value: formatDateTime(item.updatedAt) },
            ],
            actions: columns.find((column) => column.key === 'actions')?.render?.(item),
            onClick: canUpdate ? () => openEdit(item) : undefined,
          })}
        />
      )}
      <PaginationControls pagination={state.pagination} disabled={state.isFetching} onPageChange={(page) => setQuery((previous) => ({ ...previous, page }))} />
    </Screen>
  )
}
