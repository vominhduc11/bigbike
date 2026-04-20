import { useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchCategories } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'

const INITIAL_QUERY = {
  search: '',
  visibility: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 8,
}

export function CategoryListScreen({ navigate, canUpdate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    pagination: null,
    warning: '',
  })

  useEffect(() => {
    let active = true

    fetchCategories(query)
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
        key: 'name',
        label: 'Category',
        render: (category) => (
          <div>
            <strong>{formatText(category.name)}</strong>
            <p>{category.slug}</p>
          </div>
        ),
      },
      {
        key: 'description',
        label: 'Description',
        render: (category) => formatText(category.description),
      },
      {
        key: 'isVisible',
        label: 'Visibility',
        render: (category) => (
          <span className={category.isVisible ? 'status-badge status-success' : 'status-badge status-neutral'}>
            {category.isVisible ? 'Visible' : 'Hidden'}
          </span>
        ),
      },
      {
        key: 'sortOrder',
        label: 'Sort order',
        align: 'right',
        render: (category) => category.sortOrder,
      },
      {
        key: 'updatedAt',
        label: 'Updated',
        render: (category) => formatDateTime(category.updatedAt),
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'right',
        render: (category) => (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/admin/categories/${category.id}`)}
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
          <p className="eyebrow">Catalog</p>
          <h1>Categories</h1>
          <p>Category management list with live mutation endpoints.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/admin/categories/new')}
          disabled={!canUpdate}
        >
          {canUpdate ? 'Create category' : 'No update permission'}
        </button>
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
            placeholder="Search by category name or slug"
          />
        </label>
        <label>
          Visibility
          <select
            className="control-select"
            value={query.visibility}
            onChange={(event) =>
              updateQuery({ visibility: event.target.value }, { resetPage: true })
            }
          >
            <option value="ALL">All</option>
            <option value="VISIBLE">Visible</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </label>
        <label>
          Sort
          <select
            className="control-select"
            value={query.sort}
            onChange={(event) =>
              updateQuery({ sort: event.target.value }, { resetPage: true })
            }
          >
            <option value="updatedAt:desc">Updated (newest)</option>
            <option value="updatedAt:asc">Updated (oldest)</option>
            <option value="name:asc">Name (A-Z)</option>
          </select>
        </label>
      </section>

      {state.status === 'loading' ? (
        <StatePanel
          tone="info"
          title="Loading categories"
          description="Fetching category list from admin API."
        />
      ) : null}

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title="Failed to load categories"
          description={state.error || 'Unknown category list error.'}
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
          title="No categories found"
          description="Reset filters or create the first category."
          actionLabel="Reset filters"
          onAction={() => setQuery(INITIAL_QUERY)}
        />
      ) : null}

      {state.status === 'success' && state.items.length > 0 ? (
        <>
          <AdminTable caption="Category list" columns={columns} rows={state.items} />
          <PaginationControls
            pagination={state.pagination}
            onPageChange={(nextPage) => updateQuery({ page: nextPage })}
          />
        </>
      ) : null}
    </section>
  )
}
