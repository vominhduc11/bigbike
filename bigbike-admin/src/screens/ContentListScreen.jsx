import { useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { PublishStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchContent } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'

const INITIAL_QUERY = {
  search: '',
  type: 'ALL',
  publishStatus: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 8,
}

export function ContentListScreen({ navigate, canUpdate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    pagination: null,
    warning: '',
  })

  useEffect(() => {
    let active = true

    fetchContent(query)
      .then((response) => {
        if (!active) {
          return
        }

        setState({
          status: 'success',
          items: response.items,
          pagination: response.pagination,
          warning: response.mode === 'mock' ? response.warning : '',
        })
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setState({
          status: 'error',
          items: [],
          pagination: null,
          warning: '',
          error: error.message,
        })
      })

    return () => {
      active = false
    }
  }, [query])

  const columns = useMemo(
    () => [
      {
        key: 'title',
        label: 'Content',
        render: (item) => (
          <div>
            <strong>{formatText(item.title)}</strong>
            <p>{item.slug}</p>
          </div>
        ),
      },
      {
        key: 'type',
        label: 'Type',
        render: (item) => item.type,
      },
      {
        key: 'publishStatus',
        label: 'Publish',
        render: (item) => <PublishStatusBadge value={item.publishStatus} />,
      },
      {
        key: 'updatedAt',
        label: 'Updated',
        render: (item) => formatDateTime(item.updatedAt),
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'right',
        render: (item) => (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              navigate(`/admin/content/${item.type.toLowerCase()}/${item.id}`)
            }
          >
            Edit
          </button>
        ),
      },
    ],
    [navigate],
  )

  function updateQuery(partial, options = { resetPage: false }) {
    setState((previous) => ({ ...previous, status: 'loading' }))
    setQuery((previous) => ({
      ...previous,
      ...partial,
      page: options.resetPage ? 1 : previous.page,
    }))
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Article/Page list</h1>
          <p>Content management list with article and page mutation forms.</p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/content/articles/new')}
            disabled={!canUpdate}
          >
            New article
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/content/pages/new')}
            disabled={!canUpdate}
          >
            New page
          </button>
        </div>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          Search
          <input
            className="control-input"
            type="search"
            value={query.search}
            onChange={(event) =>
              updateQuery({ search: event.target.value }, { resetPage: true })
            }
            placeholder="Search by title or slug"
          />
        </label>
        <label>
          Type
          <select
            className="control-select"
            value={query.type}
            onChange={(event) =>
              updateQuery({ type: event.target.value }, { resetPage: true })
            }
          >
            <option value="ALL">All</option>
            <option value="ARTICLE">Article</option>
            <option value="PAGE">Page</option>
          </select>
        </label>
        <label>
          Publish status
          <select
            className="control-select"
            value={query.publishStatus}
            onChange={(event) =>
              updateQuery({ publishStatus: event.target.value }, { resetPage: true })
            }
          >
            <option value="ALL">All</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="HIDDEN">Hidden</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
      </section>

      {state.status === 'loading' ? (
        <StatePanel
          tone="info"
          title="Loading content list"
          description="Fetching article/page list data."
        />
      ) : null}

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title="Failed to load content list"
          description={state.error || 'Unknown content list error.'}
          actionLabel="Retry"
          onAction={() => {
            setState((previous) => ({ ...previous, status: 'loading' }))
            setQuery((previous) => ({ ...previous }))
          }}
        />
      ) : null}

      {state.status === 'success' && state.items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title="No content found"
          description="Try another search/filter combination."
          actionLabel="Reset filters"
          onAction={() => setQuery(INITIAL_QUERY)}
        />
      ) : null}

      {state.status === 'success' && state.items.length > 0 ? (
        <>
          <AdminTable caption="Content list" columns={columns} rows={state.items} />
          <PaginationControls
            pagination={state.pagination}
            onPageChange={(nextPage) => updateQuery({ page: nextPage })}
          />
        </>
      ) : null}
    </section>
  )
}
