import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { File, FileText, FolderTree, Plus } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { AdminTable } from '../components/AdminTable'
import { BulkActionBar } from '../components/BulkActionBar'
import { FilterChips } from '../components/FilterChips'
import { PublishStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { ContentCategoryManagerModal } from '../components/ContentCategoryManagerModal'
import { deleteContent, fetchContent, updateContent } from '../lib/adminApi'
import { allowedPublishOptions } from '../lib/contentPublishTransitions'
import { showConfirm } from '../lib/confirm'
import { formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const INITIAL_QUERY = {
  search: '',
  type: 'ALL',
  publishStatus: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 20,
}

export function ContentListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [selected, setSelected] = useState([])
  const [bulkBusy, setBulkBusy] = useState(false)

  const state = useAdminList(['content', query, contentLang], () => fetchContent(query))

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setSelected([])
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  function updateQuery(partial, options = { resetPage: false }) {
    setSelected([])
    setQuery((previous) => {
      const next = { ...previous, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setSelected([])
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
  const createPath = createIsPage ? '/admin/content/pages/new' : '/admin/content/articles/new'

  const isFiltered = query.search !== INITIAL_QUERY.search
    || query.type !== INITIAL_QUERY.type
    || query.publishStatus !== INITIAL_QUERY.publishStatus

  const isTrashView = query.publishStatus === 'TRASH'

  // Áp hành động hàng loạt: lặp lại đúng thao tác đơn lẻ đã được phép (xoá vào
  // thùng rác / đổi trạng thái xuất bản), nhưng TÔN TRỌNG state machine — chỉ áp
  // cho hàng có chuyển trạng thái hợp lệ (allowedPublishOptions, mirror
  // STATE_MACHINES.md). Hàng không hợp lệ bị bỏ qua và báo trong toast.
  async function runBulk({ confirmKey, titleKey, confirmLabel, variant, action, isEligible }) {
    const targets = items.filter((row) => selected.includes(row.id) && (isEligible ? isEligible(row) : true))
    if (targets.length === 0) return
    const skipped = selected.length - targets.length
    const confirmed = await showConfirm(
      t(confirmKey, { count: targets.length }),
      t(titleKey),
      { confirmLabel: t(confirmLabel), variant },
    )
    if (!confirmed) return
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(targets.map((row) => action(row)))
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const fail = results.length - ok
      queryClient.invalidateQueries({ queryKey: ['content'] })
      setSelected([])
      if (fail === 0 && skipped === 0) {
        toast.success(t('content.bulkSuccess', { count: ok, defaultValue: `Đã cập nhật ${ok} mục.` }))
      } else {
        toast.warning(t('content.bulkPartial', {
          ok, fail, skipped,
          defaultValue: `Thành công ${ok}, lỗi ${fail}, bỏ qua ${skipped}.`,
        }))
      }
    } finally {
      setBulkBusy(false)
    }
  }

  function handleBulkTrash() {
    runBulk({
      confirmKey: 'content.bulkTrashConfirm',
      titleKey: 'content.bulkTrashTitle',
      confirmLabel: 'content.bulkTrashConfirmCta',
      variant: 'danger',
      action: (row) => deleteContent(row.type, row.id),
    })
  }

  function handleBulkPublishStatus(target, confirmKey, titleKey, confirmLabel) {
    runBulk({
      confirmKey, titleKey, confirmLabel,
      isEligible: (row) => allowedPublishOptions(row.publishStatus).includes(target),
      action: (row) => updateContent(row.type, row.id, { publishStatus: target }),
    })
  }

  const bulkActions = canUpdate
    ? (isTrashView
        ? [{
            label: t('content.bulkRestore', { defaultValue: 'Khôi phục' }),
            onClick: () => handleBulkPublishStatus('DRAFT', 'content.bulkRestoreConfirm', 'content.bulkRestoreTitle', 'content.bulkRestoreCta'),
            disabled: bulkBusy,
          }]
        : [
            {
              label: t('content.bulkPublish', { defaultValue: 'Xuất bản' }),
              onClick: () => handleBulkPublishStatus('PUBLISHED', 'content.bulkPublishConfirm', 'content.bulkPublishTitle', 'content.bulkPublishCta'),
              disabled: bulkBusy,
            },
            {
              label: t('content.bulkHide', { defaultValue: 'Ẩn' }),
              onClick: () => handleBulkPublishStatus('HIDDEN', 'content.bulkHideConfirm', 'content.bulkHideTitle', 'content.bulkHideCta'),
              disabled: bulkBusy,
            },
            {
              label: t('content.bulkTrash', { defaultValue: 'Chuyển vào thùng rác' }),
              tone: 'danger',
              onClick: handleBulkTrash,
              disabled: bulkBusy,
            },
          ])
    : []

  // Chip bộ lọc đang bật (ngoài mặc định) — mỗi chip có nút X để gỡ riêng.
  const filterChips = useMemo(() => {
    const chips = []
    if (query.search) {
      chips.push({
        key: 'search',
        label: `${t('common.search', { defaultValue: 'Tìm kiếm' })}: ${query.search}`,
        onRemove: () => setSearchInput(INITIAL_QUERY.search),
      })
    }
    if (query.type !== 'ALL') {
      chips.push({
        key: 'type',
        label: `${t('content.filterType')}: ${query.type === 'PAGE' ? t('content.typePage') : t('content.typeArticle')}`,
        onRemove: () => updateQuery({ type: 'ALL' }, { resetPage: true }),
      })
    }
    if (query.publishStatus !== 'ALL') {
      chips.push({
        key: 'publish',
        label: `${t('content.filterPublish')}: ${t(`status.publish.${query.publishStatus}`, { defaultValue: query.publishStatus })}`,
        onRemove: () => updateQuery({ publishStatus: 'ALL' }, { resetPage: true }),
      })
    }
    return chips
  }, [query.search, query.type, query.publishStatus, t])

  // Sort phía máy chủ — endpoint content nhận "field:dir" (mặc định updatedAt:desc).
  const [sortField, sortDir] = (query.sort || '').split(':')
  function handleSortChange(key, dir) {
    updateQuery({ sort: `${key}:${dir}` }, { resetPage: true })
  }

  const columns = [
    {
      key: 'title',
      label: t('content.colContent'),
      sortable: true,
      skeletonWidth: '80%',
      render: (item) => {
        const isPage = item.type === 'PAGE'
        return (
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
        )
      },
    },
    {
      key: 'type',
      label: t('content.colType'),
      render: (item) => {
        const isPage = item.type === 'PAGE'
        return (
          <span className={`bb-badge ${isPage ? 'bb-badge-neutral' : 'bb-badge-info'}`}>
            {isPage ? t('content.typePage') : t('content.typeArticle')}
          </span>
        )
      },
    },
    {
      key: 'publishStatus',
      label: t('content.colPublish'),
      // Backend whitelist content sort gồm publishStatus (CONTENT_SORT_FIELDS) →
      // sort theo trạng thái xuất bản để gom nhóm bản nháp/đã đăng khi triage.
      sortable: true,
      render: (item) => <PublishStatusBadge value={item.publishStatus} />,
    },
    {
      key: 'updatedAt',
      label: t('content.colUpdated'),
      sortable: true,
      render: (item) => <span className="bb-muted" style={{ fontSize: 12 }}>{formatDateTime(item.updatedAt)}</span>,
    },
  ]

  const mobileCard = (item) => {
    const isPage = item.type === 'PAGE'
    return {
      title: formatText(item.title),
      subtitle: `/${item.slug}`,
      status: <PublishStatusBadge value={item.publishStatus} />,
      meta: [
        {
          label: t('content.colType'),
          value: (
            <span className={`bb-badge ${isPage ? 'bb-badge-neutral' : 'bb-badge-info'}`}>
              {isPage ? t('content.typePage') : t('content.typeArticle')}
            </span>
          ),
        },
        { label: t('content.colUpdated'), value: formatDateTime(item.updatedAt) },
      ],
      onClick: () => navigate(`/admin/content/${item.type.toLowerCase()}/${item.id}`),
    }
  }

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('content.eyebrow')}</p>
          <h1>{t('content.title')}</h1>
          <p className="bb-muted">{t('content.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            disabled={!canUpdate}
            onClick={() => setCategoryModalOpen(true)}
            title={t('content.categoryManager.title', { defaultValue: 'Quản lý danh mục bài viết' })}
          >
            <FolderTree size={14} />{t('content.categoryManager.button', { defaultValue: 'Danh mục' })}
          </button>
          <button
            type="button"
            className="bb-btn bb-btn-primary"
            disabled={!canUpdate}
            onClick={() => navigate(createPath)}
          >
            <Plus size={14} />
            {createIsPage ? t('content.newPage') : t('content.newArticle')}
          </button>
        </div>
      </div>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {/* Type tabs — prototype segmented control */}
      <div className="bb-seg" style={{ marginBottom: 16 }} role="tablist" aria-label={t('content.filterType')}>
        {typeTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={query.type === tab.key}
            className={query.type === tab.key ? 'active' : ''}
            onClick={() => updateQuery({ type: tab.key }, { resetPage: true })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('content.searchPlaceholder')}
        />
        <FilterSelect
          value={query.publishStatus}
          onValueChange={(v) => updateQuery({ publishStatus: v }, { resetPage: true })}
          ariaLabel={t('content.filterPublish')}
          options={[
            { value: 'ALL', label: t('content.filterPublish') },
            { value: 'DRAFT', label: t('status.publish.DRAFT') },
            { value: 'PUBLISHED', label: t('status.publish.PUBLISHED') },
            { value: 'HIDDEN', label: t('status.publish.HIDDEN') },
            { value: 'TRASH', label: t('status.publish.TRASH') },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
        />
      </div>

      <FilterChips
        chips={filterChips}
        onClearAll={filterChips.length > 1 ? resetFilters : undefined}
        clearAllLabel={t('common.resetFilters')}
        removeChipLabel={t('common.resetFilters')}
        ariaLabel={t('content.activeFilters', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {canUpdate ? (
        <BulkActionBar
          selectedCount={selected.length}
          onClear={() => setSelected([])}
          actions={bulkActions}
        />
      ) : null}

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
        isFiltered ? (
          <StatePanel
            tone="neutral"
            title={t('content.empty')}
            description={t('content.emptyDesc')}
            actionLabel={t('common.resetFilters')}
            onAction={resetFilters}
          />
        ) : (
          <StatePanel
            tone="neutral"
            title={t('content.emptyNoData', { defaultValue: 'Chưa có nội dung nào' })}
            description={t('content.emptyNoDataDesc', { defaultValue: 'Bắt đầu bằng cách tạo bài viết hoặc trang đầu tiên.' })}
            actionLabel={canUpdate ? (createIsPage ? t('content.newPage') : t('content.newArticle')) : undefined}
            onAction={canUpdate ? () => navigate(createPath) : undefined}
          />
        )
      ) : null}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <AdminTable
              columns={columns}
              rows={items}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              onRowClick={(item) => navigate(`/admin/content/${item.type.toLowerCase()}/${item.id}`)}
              mobileCard={mobileCard}
              sortKey={sortField}
              sortDir={sortDir}
              onSortChange={handleSortChange}
              selectable={canUpdate}
              selectedIds={selected}
              onSelectionChange={setSelected}
            />
          </div>
          {state.status === 'success' && pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={(p) => updateQuery({ page: p })}
            />
          )}
        </div>
      )}

      <ContentCategoryManagerModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
      />
    </div>
  )
}
