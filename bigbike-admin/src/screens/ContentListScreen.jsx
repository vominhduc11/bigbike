import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
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

  const columns = useMemo(
    () => [
      {
        key: 'title',
        label: t('content.colContent'),
        render: (item) => (
          <div className="product-cell">
            <div className="thumbnail-wrap">
              {item.coverImage?.url ? (
                <img
                  src={item.coverImage.url}
                  alt={item.coverImage.alt || item.title}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = ''; }}
                />
              ) : null}
              <span style={{ display: item.coverImage?.url ? 'none' : '' }}>IMG</span>
            </div>
            <div>
              <strong>{formatText(item.title)}</strong>
              <p>{item.slug}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'type',
        label: t('content.colType'),
        render: (item) => (
          <span className={`status-badge ${item.type === 'PAGE' ? 'status-neutral' : 'status-info'}`}>
            {item.type === 'PAGE' ? t('content.typePage') : t('content.typeArticle')}
          </span>
        ),
      },
      {
        key: 'publishStatus',
        label: t('content.colPublish'),
        render: (item) => <PublishStatusBadge value={item.publishStatus} />,
      },
      {
        key: 'updatedAt',
        label: t('content.colUpdated'),
        render: (item) => formatDateTime(item.updatedAt),
      },
      {
        key: 'actions',
        label: t('content.colActions'),
        align: 'right',
        render: (item) => (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/admin/content/${item.type.toLowerCase()}/${item.id}`)}
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
          <p className="eyebrow">{t('content.eyebrow')}</p>
          <h1>{t('content.title')}</h1>
          <p>{t('content.description')}</p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/content/articles/new')}
            disabled={!canUpdate}
          >
            {t('content.newArticle')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/content/pages/new')}
            disabled={!canUpdate}
          >
            {t('content.newPage')}
          </button>
        </div>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <input
            className="control-input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('content.searchPlaceholder')}
          />
        </label>
        <label>
          {t('content.filterType')}
          <select
            className="control-select"
            value={query.type}
            onChange={(event) =>
              updateQuery({ type: event.target.value }, { resetPage: true })
            }
          >
            <option value="ALL">{t('common.all')}</option>
            <option value="ARTICLE">{t('content.typeArticle')}</option>
            <option value="PAGE">{t('content.typePage')}</option>
          </select>
        </label>
        <label>
          {t('content.filterPublish')}
          <select
            className="control-select"
            value={query.publishStatus}
            onChange={(event) =>
              updateQuery({ publishStatus: event.target.value }, { resetPage: true })
            }
          >
            <option value="ALL">{t('common.all')}</option>
            <option value="DRAFT">{t('status.publish.DRAFT')}</option>
            <option value="PUBLISHED">{t('status.publish.PUBLISHED')}</option>
            <option value="HIDDEN">{t('status.publish.HIDDEN')}</option>
            <option value="TRASH">{t('status.publish.TRASH')}</option>
          </select>
        </label>
      </section>

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('content.loadError')}
          description={state.error || 'Unknown content list error.'}
          actionLabel={t('common.retry')}
          onAction={() => state.refetch()}
        />
      ) : null}

      {state.status === 'success' && state.items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={t('content.empty')}
          description={t('content.emptyDesc')}
          actionLabel={t('common.resetFilters')}
          onAction={resetFilters}
        />
      ) : null}

      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('content.tableCaption')}
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
