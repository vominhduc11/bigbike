import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchBrands } from '../lib/adminApi'
import { formatDateTime, formatText, stripHtml } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const INITIAL_QUERY = {
  search: '',
  visibility: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 8,
}

export function BrandListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)

  const state = useAdminList(['brands', query], () => fetchBrands(query))

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: t('brands.colBrand'),
        render: (brand) => (
          <div className="product-cell">
            <div className="thumbnail-wrap">
              {brand.logo?.url ? (
                <img src={brand.logo.url} alt={brand.logo.alt || brand.name} referrerPolicy="no-referrer" loading="lazy" />
              ) : (
                <span>IMG</span>
              )}
            </div>
            <div>
              <strong>{formatText(brand.name)}</strong>
              <p>{brand.slug}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'description',
        label: t('brands.colDescription'),
        render: (brand) => stripHtml(brand.description),
      },
      {
        key: 'isVisible',
        label: t('brands.colVisibility'),
        render: (brand) => (
          <span className={brand.isVisible ? 'status-badge status-success' : 'status-badge status-neutral'}>
            {brand.isVisible ? t('common.visible') : t('common.hidden')}
          </span>
        ),
      },
      {
        key: 'updatedAt',
        label: t('brands.colUpdated'),
        render: (brand) => formatDateTime(brand.updatedAt),
      },
      {
        key: 'actions',
        label: t('brands.colActions'),
        align: 'right',
        render: (brand) => (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/admin/brands/${brand.id}`)}
          >
            {t('common.edit')}
          </button>
        ),
      },
    ],
    [navigate, t],
  )

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((previous) => {
      const next = { ...previous, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setQuery(INITIAL_QUERY)
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('brands.eyebrow')}</p>
          <h1>{t('brands.title')}</h1>
          <p>{t('brands.description')}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/admin/brands/new')}
          disabled={!canUpdate}
        >
          {canUpdate ? t('brands.create') : t('common.noPermission')}
        </button>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('brands.searchPlaceholder')}
           />
        </label>
        <label>
          {t('brands.filterVisibility')}
          <Select
            value={query.visibility}
            onValueChange={(event) =>
              updateQuery({ visibility: event.target.value }, { resetPage: true })}
          ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">{t('common.all')}</SelectItem>
            <SelectItem value="VISIBLE">{t('common.visible')}</SelectItem>
            <SelectItem value="HIDDEN">{t('common.hidden')}</SelectItem>
          </SelectContent></Select>
        </label>
        <label>
          {t('brands.filterSort')}
          <Select
            value={query.sort}
            onValueChange={(event) =>
              updateQuery({ sort: event.target.value }, { resetPage: true })}
          ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="updatedAt:desc">{t('sort.newestUpdated')}</SelectItem>
            <SelectItem value="updatedAt:asc">{t('sort.oldestUpdated')}</SelectItem>
            <SelectItem value="name:asc">{t('sort.nameAZ')}</SelectItem>
          </SelectContent></Select>
        </label>
      </section>

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('brands.loadError')}
          description={state.error || 'Unknown brand list error.'}
          actionLabel={t('common.retry')}
          onAction={() => state.refetch()}
        />
      ) : null}

      {state.status === 'success' && state.items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={t('brands.empty')}
          description={t('brands.emptyDesc')}
          actionLabel={t('common.resetFilters')}
          onAction={resetFilters}
        />
      ) : null}

      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('brands.tableCaption')}
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
          />
          {state.status === 'success' && (
            <PaginationControls
              pagination={state.pagination}
              onPageChange={(nextPage) => updateQuery({ page: nextPage })}
            />
          )}
        </>
      ) : null}
    </section>
  )
}
