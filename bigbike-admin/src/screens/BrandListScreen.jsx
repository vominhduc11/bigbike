import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Award, Pencil, Plus, Search } from 'lucide-react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchBrands } from '../lib/adminApi'
import { formatDateTime, formatText, stripHtml } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const INITIAL_QUERY = {
  search: '',
  visibility: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 20,
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

  const items = state.items || []
  const pagination = state.pagination

  return (
    <div>
      <div className="screen-header">
        <div>
          <p className="eyebrow">{t('brands.eyebrow')}</p>
          <h1>{t('brands.title')}</h1>
          <p className="desc">{t('brands.description')}</p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/brands/new')}
            disabled={!canUpdate}
          >
            <Plus size={14} />{canUpdate ? t('brands.create') : t('common.noPermission')}
          </button>
        </div>
      </div>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={14} />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('brands.searchPlaceholder')}
          />
        </div>
        <select
          className="filter-select"
          value={query.visibility}
          onChange={(e) => updateQuery({ visibility: e.target.value }, { resetPage: true })}
          aria-label={t('brands.filterVisibility')}
        >
          <option value="ALL">{t('brands.filterVisibility')}</option>
          <option value="VISIBLE">{t('common.visible')}</option>
          <option value="HIDDEN">{t('common.hidden')}</option>
        </select>
        <select
          className="filter-select"
          value={query.sort}
          onChange={(e) => updateQuery({ sort: e.target.value }, { resetPage: true })}
          aria-label={t('brands.filterSort')}
        >
          <option value="updatedAt:desc">{t('sort.newestUpdated')}</option>
          <option value="updatedAt:asc">{t('sort.oldestUpdated')}</option>
          <option value="name:asc">{t('sort.nameAZ')}</option>
        </select>
      </div>

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('brands.loadError')}
          description={state.error || 'Unknown brand list error.'}
          actionLabel={t('common.retry')}
          onAction={() => state.refetch()}
        />
      ) : null}

      {state.status === 'success' && items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={t('brands.empty')}
          description={t('brands.emptyDesc')}
          actionLabel={t('common.resetFilters')}
          onAction={resetFilters}
        />
      ) : null}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="card">
          <div className="card-body card-body--flush">
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('brands.colBrand')}</th>
                    <th>{t('brands.colDescription')}</th>
                    <th>{t('brands.colVisibility')}</th>
                    <th>{t('brands.colUpdated')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.status === 'loading' && items.length === 0 && (
                    [...Array(8)].map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={5}><div className="dash-skeleton-block" style={{ height: 32 }} /></td>
                      </tr>
                    ))
                  )}
                  {items.map((brand) => (
                    <tr key={brand.id} onClick={() => navigate(`/admin/brands/${brand.id}`)}>
                      <td>
                        <div className="product-cell">
                          <span className="thumb">
                            {brand.logo?.url ? (
                              <img
                                src={brand.logo.url}
                                alt={brand.logo.alt || brand.name}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            ) : <Award size={18} />}
                          </span>
                          <div className="info">
                            <div className="name">{formatText(brand.name)}</div>
                            <div className="sku">/{brand.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="muted text-sm">{stripHtml(brand.description)}</td>
                      <td><StatusBadge type="visibility" status={brand.isVisible} /></td>
                      <td className="muted text-xs">{formatDateTime(brand.updatedAt)}</td>
                      <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="icon-btn"
                          title={t('common.edit')}
                          onClick={() => navigate(`/admin/brands/${brand.id}`)}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {state.status === 'success' && pagination && (
            <div className="card-foot">
              <span>
                {t('common.paginationSummary', {
                  defaultValue: `Hiển thị ${items.length} trong ${pagination.totalItems} thương hiệu`,
                  count: items.length,
                  total: pagination.totalItems,
                })}
              </span>
              <div className="pager">
                <button type="button" disabled={pagination.page <= 1} onClick={() => updateQuery({ page: pagination.page - 1 })}>‹</button>
                <button type="button" className="active">{pagination.page}</button>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateQuery({ page: pagination.page + 1 })}>›</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
