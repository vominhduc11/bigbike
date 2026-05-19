import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, File, FileText, Pencil, Plus, Search } from 'lucide-react'
import { PublishStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchContent } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const INITIAL_QUERY = {
  search: '',
  type: 'ALL',
  publishStatus: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 8,
}

export function ContentListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)

  const state = useAdminList(['content', query], () => fetchContent(query))

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

  // Content type as a segmented tab bar — quick switch between articles & pages.
  const typeTabs = useMemo(() => [
    { key: 'ALL', label: t('common.all') },
    { key: 'ARTICLE', label: t('content.typeArticle') },
    { key: 'PAGE', label: t('content.typePage') },
  ], [t])

  const items = state.items || []
  const pagination = state.pagination
  // The header "create" button matches whichever type tab is active.
  const createIsPage = query.type === 'PAGE'

  return (
    <div>
      <div className="screen-header">
        <div>
          <p className="eyebrow">{t('content.eyebrow')}</p>
          <h1>{t('content.title')}</h1>
          <p className="desc">{t('content.description')}</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-outline" disabled title={t('common.exportCsv', { defaultValue: 'Xuất CSV' })}>
            <Download size={14} />{t('common.exportCsv', { defaultValue: 'Xuất CSV' })}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canUpdate}
            onClick={() => navigate(createIsPage ? '/admin/content/pages/new' : '/admin/content/articles/new')}
          >
            <Plus size={14} />
            {createIsPage ? t('content.newPage') : t('content.newArticle')}
          </button>
        </div>
      </div>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {/* Type tabs — prototype segmented control */}
      <div className="seg mb-4" role="tablist" aria-label={t('content.filterType')}>
        {typeTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={query.type === tab.key}
            className={`seg-tab${query.type === tab.key ? ' active' : ''}`}
            onClick={() => updateQuery({ type: tab.key }, { resetPage: true })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={14} />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('content.searchPlaceholder')}
          />
        </div>
        <select
          className="filter-select"
          value={query.publishStatus}
          onChange={(e) => updateQuery({ publishStatus: e.target.value }, { resetPage: true })}
          aria-label={t('content.filterPublish')}
        >
          <option value="ALL">{t('content.filterPublish')}</option>
          <option value="DRAFT">{t('status.publish.DRAFT')}</option>
          <option value="PUBLISHED">{t('status.publish.PUBLISHED')}</option>
          <option value="HIDDEN">{t('status.publish.HIDDEN')}</option>
          <option value="TRASH">{t('status.publish.TRASH')}</option>
        </select>
      </div>

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('content.loadError')}
          description={state.error || 'Unknown content list error.'}
          actionLabel={t('common.retry')}
          onAction={() => state.refetch()}
        />
      ) : null}

      {state.status === 'success' && items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={t('content.empty')}
          description={t('content.emptyDesc')}
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
                    <th>{t('content.colContent')}</th>
                    <th>{t('content.colType')}</th>
                    <th>{t('content.colPublish')}</th>
                    <th>{t('content.colUpdated')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.status === 'loading' && items.length === 0 && (
                    [...Array(6)].map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={5}><div className="dash-skeleton-block" style={{ height: 32 }} /></td>
                      </tr>
                    ))
                  )}
                  {items.map((item) => {
                    const editPath = `/admin/content/${item.type.toLowerCase()}/${item.id}`
                    const isPage = item.type === 'PAGE'
                    return (
                      <tr key={item.id} onClick={() => navigate(editPath)}>
                        <td>
                          <div className="product-cell">
                            <span className="thumb">
                              {item.coverImage?.url ? (
                                <img
                                  src={item.coverImage.url}
                                  alt={item.coverImage.alt || item.title}
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : isPage ? <File size={16} /> : <FileText size={16} />}
                            </span>
                            <div className="info">
                              <div className="name">{formatText(item.title)}</div>
                              <div className="sku">/{item.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${isPage ? 'badge-neutral' : 'badge-info'}`}>
                            {isPage ? t('content.typePage') : t('content.typeArticle')}
                          </span>
                        </td>
                        <td><PublishStatusBadge value={item.publishStatus} /></td>
                        <td className="muted text-xs">{formatDateTime(item.updatedAt)}</td>
                        <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="icon-btn"
                            title={t('common.edit')}
                            onClick={() => navigate(editPath)}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {state.status === 'success' && pagination && (
            <div className="card-foot">
              <span>
                {t('common.paginationSummary', {
                  defaultValue: `Hiển thị ${items.length} trong ${pagination.totalItems} nội dung`,
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
