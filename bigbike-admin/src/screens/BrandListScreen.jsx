import { useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchBrands } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'

const INITIAL_QUERY = {
  search: '',
  visibility: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 8,
}

export function BrandListScreen({ navigate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    pagination: null,
    warning: '',
  })

  useEffect(() => {
    let active = true

    fetchBrands(query)
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
        label: 'Brand',
        render: (brand) => (
          <div>
            <strong>{formatText(brand.name)}</strong>
            <p>{brand.slug}</p>
          </div>
        ),
      },
      {
        key: 'description',
        label: 'Description',
        render: (brand) => formatText(brand.description),
      },
      {
        key: 'isVisible',
        label: 'Visibility',
        render: (brand) => (
          <span className={brand.isVisible ? 'status-badge status-success' : 'status-badge status-neutral'}>
            {brand.isVisible ? 'Visible' : 'Hidden'}
          </span>
        ),
      },
      {
        key: 'updatedAt',
        label: 'Updated',
        render: (brand) => formatDateTime(brand.updatedAt),
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'right',
        render: (brand) => (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/admin/brands/${brand.id}`)}
          >
            Detail shell
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
          <h1>Brands</h1>
          <p>Brand list/detail foundation for admin catalog management.</p>
        </div>
        <button type="button" className="btn btn-primary" disabled>
          Create brand (TBD)
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
            placeholder="Search by brand name or slug"
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
          title="Loading brands"
          description="Fetching brand list from admin API."
        />
      ) : null}

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title="Failed to load brands"
          description={state.error || 'Unknown brand list error.'}
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
          title="No brands found"
          description="Reset filters or create a new brand when mutation API is available."
          actionLabel="Reset filters"
          onAction={() => setQuery(INITIAL_QUERY)}
        />
      ) : null}

      {state.status === 'success' && state.items.length > 0 ? (
        <>
          <AdminTable caption="Brand list" columns={columns} rows={state.items} />
          <PaginationControls
            pagination={state.pagination}
            onPageChange={(nextPage) => updateQuery({ page: nextPage })}
          />
        </>
      ) : null}
    </section>
  )
}
