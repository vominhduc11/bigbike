import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { Award, Pencil, Plus } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { MobileCardList, MobileCard } from '../components/layout/MobileCardList'
import { fetchBrands } from '../lib/adminApi'
import { formatDateTime, formatText, stripHtml } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useContentLang } from '../lib/contentLang'
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
  const contentLang = useContentLang()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)

  const state = useAdminList(['brands', query, contentLang], () => fetchBrands(query))

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
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('brands.eyebrow')}</p>
          <h1>{t('brands.title')}</h1>
          <p className="bb-muted">{t('brands.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <button
            type="button"
            className="bb-btn bb-btn-primary"
            onClick={() => navigate('/admin/brands/new')}
            disabled={!canUpdate}
          >
            <Plus size={14} />{canUpdate ? t('brands.create') : t('common.noPermission')}
          </button>
        </div>
      </div>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('brands.searchPlaceholder')}
        />
        <FilterSelect
          value={query.visibility}
          onValueChange={(v) => updateQuery({ visibility: v }, { resetPage: true })}
          ariaLabel={t('brands.filterVisibility')}
          options={[
            { value: 'ALL', label: t('brands.filterVisibility') },
            { value: 'VISIBLE', label: t('common.visible') },
            { value: 'HIDDEN', label: t('common.hidden') },
          ]}
        />
        <FilterSelect
          value={query.sort}
          onValueChange={(v) => updateQuery({ sort: v }, { resetPage: true })}
          ariaLabel={t('brands.filterSort')}
          options={[
            { value: 'updatedAt:desc', label: t('sort.newestUpdated') },
            { value: 'updatedAt:asc', label: t('sort.oldestUpdated') },
            { value: 'name:asc', label: t('sort.nameAZ') },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
        />
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
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            {/* responsive: table on tablet+/desktop, cards on phones */}
            <div className="hide-on-mobile">
            <div className="bb-table-wrap">
              <table className="bb-table">
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
                      <td className="bb-muted">{stripHtml(brand.description)}</td>
                      <td><StatusBadge type="visibility" status={brand.isVisible} /></td>
                      <td className="bb-muted" style={{ fontSize: 12 }}>{formatDateTime(brand.updatedAt)}</td>
                      <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="bb-icon-btn"
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
            <MobileCardList>
              {items.map((brand) => (
                <MobileCard
                  key={brand.id}
                  title={formatText(brand.name)}
                  subtitle={`/${brand.slug}`}
                  status={<StatusBadge type="visibility" status={brand.isVisible} />}
                  meta={[
                    { label: t('brands.colDescription'), value: stripHtml(brand.description) },
                    { label: t('brands.colUpdated'), value: formatDateTime(brand.updatedAt) },
                  ]}
                  actions={(
                    <button
                      type="button"
                      className="bb-icon-btn"
                      title={t('common.edit')}
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/brands/${brand.id}`) }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  onClick={() => navigate(`/admin/brands/${brand.id}`)}
                />
              ))}
            </MobileCardList>
          </div>
          {state.status === 'success' && pagination && (
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
