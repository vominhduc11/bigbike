import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { FileText, Plus, Pencil, Trash2, Undo2 } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { AdminTable } from '../components/AdminTable'
import { BulkActionBar } from '../components/BulkActionBar'
import { FilterChips } from '../components/FilterChips'
import { PublishStatusBadge } from '../components/StatusBadge'
import { publishRowAccent } from '../lib/statusTone'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { StatePanel } from '../components/StatePanel'
import { deleteContent, fetchContent, updateContent, restoreContent, permanentDeleteContent } from '../lib/adminApi'
import { allowedPublishOptions } from '../lib/contentPublishTransitions'
import { showConfirm } from '../lib/confirm'
import { formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { useRecentItems } from '../lib/useRecentItems'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

// Module chỉ còn quản lý BÀI VIẾT (Tin tức). Trang thông tin tĩnh (chính sách, hướng dẫn…)
// đã đóng cứng trong web (owner 2026-06-24), không còn quản lý trong admin. type cố định ARTICLE.
const ARTICLE_TYPE = 'ARTICLE'

const INITIAL_QUERY = {
  search: '',
  type: ARTICLE_TYPE,
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
  const [selected, setSelected] = useState([])
  const [bulkBusy, setBulkBusy] = useState(false)
  // O9: "Vừa xem/sửa" — bài viết vừa mở ở ContentDetailScreen (ghi qua recordRecentItem).
  const recentContentItems = useRecentItems('recent:content')

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

  const items = state.items || []
  const pagination = state.pagination
  const createPath = '/admin/content/articles/new'

  const isFiltered = query.search !== INITIAL_QUERY.search
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

  const handleSoftDelete = async (item) => {
    const confirmed = await showConfirm(
      t('content.deleteConfirm', { title: item.title, defaultValue: `Bạn có chắc chắn muốn xóa bài viết "${item.title}"?` }),
      t('content.deleteConfirmTitle', { defaultValue: 'Xác nhận xóa' }),
      { confirmLabel: t('common.delete'), variant: 'danger' }
    )
    if (!confirmed) return

    try {
      await deleteContent(item.type, item.id)
      queryClient.invalidateQueries({ queryKey: ['content'] })
      toast.success(t('content.deleteSuccess', { defaultValue: 'Đã chuyển bài viết vào Thùng rác.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
    }
  }

  const handleRestore = async (item) => {
    const confirmed = await showConfirm(
      t('content.restoreConfirm', { title: item.title, defaultValue: `Bạn có chắc chắn muốn khôi phục bài viết "${item.title}"?` }),
      t('content.restoreConfirmTitle', { defaultValue: 'Xác nhận khôi phục' }),
      { confirmLabel: t('products.restore'), variant: 'default' }
    )
    if (!confirmed) return

    try {
      await restoreContent(item.type, item.id)
      queryClient.invalidateQueries({ queryKey: ['content'] })
      toast.success(t('content.restoreSuccess', { defaultValue: 'Khôi phục bài viết thành công.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
    }
  }

  const handlePermanentDelete = async (item) => {
    const confirmed = await showConfirm(
      t('content.permanentDeleteConfirm', { title: item.title, defaultValue: `Bạn có chắc chắn muốn xóa vĩnh viễn bài viết "${item.title}"? Thao tác này không thể hoàn tác.` }),
      t('content.permanentDeleteConfirmTitle', { defaultValue: 'Xác nhận xóa vĩnh viễn' }),
      { confirmLabel: t('common.permanentDelete'), variant: 'danger' }
    )
    if (!confirmed) return

    try {
      await permanentDeleteContent(item.type, item.id)
      queryClient.invalidateQueries({ queryKey: ['content'] })
      toast.success(t('content.permanentDeleteSuccess', { defaultValue: 'Xóa vĩnh viễn bài viết thành công.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
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

  function handleBulkRestore() {
    runBulk({
      confirmKey: 'content.bulkRestoreConfirm',
      titleKey: 'content.bulkRestoreTitle',
      confirmLabel: 'products.restore',
      variant: 'default',
      action: (row) => restoreContent(row.type, row.id),
    })
  }

  function handleBulkHardDelete() {
    runBulk({
      confirmKey: 'content.bulkHardDeleteConfirm',
      titleKey: 'content.bulkHardDeleteTitle',
      confirmLabel: 'common.permanentDelete',
      variant: 'danger',
      action: (row) => permanentDeleteContent(row.type, row.id),
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
        ? [
            {
              label: t('content.bulkRestore', { defaultValue: 'Khôi phục' }),
              onClick: handleBulkRestore,
              disabled: bulkBusy,
            },
            {
              label: t('content.bulkHardDelete', { defaultValue: 'Xóa vĩnh viễn' }),
              tone: 'danger',
              onClick: handleBulkHardDelete,
              disabled: bulkBusy,
            }
          ]
        : [
            {
              label: t('content.bulkPublish', { defaultValue: 'Xuất bản' }),
              onClick: () => handleBulkPublishStatus('PUBLISHED', 'content.bulkPublishConfirm', 'content.bulkPublishTitle', 'content.bulkPublishCta'),
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
    if (query.publishStatus !== 'ALL') {
      chips.push({
        key: 'publish',
        label: `${t('content.filterPublish')}: ${t(`status.publish.${query.publishStatus}`, { defaultValue: query.publishStatus })}`,
        onRemove: () => updateQuery({ publishStatus: 'ALL' }, { resetPage: true }),
      })
    }
    return chips
  }, [query.search, query.publishStatus, t])

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
      render: (item) => (
        <div className="product-cell">
          <span className="bb-product-thumb">
            {item.coverImage?.url ? (
              <img
                src={item.coverImage.url}
                alt={item.coverImage.alt || item.title}
                referrerPolicy="no-referrer"
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : <FileText size={16} />}
          </span>
          <div className="info">
            <div className="name">{formatText(item.title)}</div>
            <div className="sku">/{item.slug}</div>
          </div>
        </div>
      ),
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
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (item) => {
        const isTrashed = query.publishStatus === 'TRASH'
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
            {!isTrashed && (
              <button
                type="button"
                className="bb-icon-btn"
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => navigate(`/admin/content/${item.type.toLowerCase()}/${item.id}`)}
              >
                <Pencil size={14} />
              </button>
            )}
            {canUpdate && !isTrashed && (
              <button
                type="button"
                className="bb-icon-btn danger"
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => handleSoftDelete(item)}
              >
                <Trash2 size={14} />
              </button>
            )}
            {canUpdate && isTrashed && (
              <>
                <button
                  type="button"
                  className="bb-icon-btn"
                  title={t('products.restore')}
                  aria-label={t('products.restore')}
                  onClick={() => handleRestore(item)}
                >
                  <Undo2 size={14} />
                </button>
                <button
                  type="button"
                  className="bb-icon-btn danger"
                  title={t('common.permanentDelete')}
                  aria-label={t('common.permanentDelete')}
                  onClick={() => handlePermanentDelete(item)}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  const mobileCard = (item) => {
    const isTrashed = query.publishStatus === 'TRASH'
    return {
      title: formatText(item.title),
      subtitle: `/${item.slug}`,
      status: <PublishStatusBadge value={item.publishStatus} />,
      meta: [
        { label: t('content.colUpdated'), value: formatDateTime(item.updatedAt) },
      ],
      actions: (
        <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          {!isTrashed && (
            <button
              type="button"
              className="bb-icon-btn"
              title={t('common.edit')}
              onClick={() => navigate(`/admin/content/${item.type.toLowerCase()}/${item.id}`)}
            >
              <Pencil size={14} />
            </button>
          )}
          {canUpdate && !isTrashed && (
            <button
              type="button"
              className="bb-icon-btn danger"
              title={t('common.delete')}
              onClick={() => handleSoftDelete(item)}
            >
              <Trash2 size={14} />
            </button>
          )}
          {canUpdate && isTrashed && (
            <>
              <button
                type="button"
                className="bb-icon-btn"
                disabled={bulkBusy}
                title={t('products.restore')}
                onClick={() => handleRestore(item)}
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                className="bb-icon-btn danger"
                disabled={bulkBusy}
                title={t('common.permanentDelete')}
                onClick={() => handlePermanentDelete(item)}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ),
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
            className="bb-btn bb-btn-primary"
            disabled={!canUpdate}
            onClick={() => navigate(createPath)}
          >
            <Plus size={14} />
            {t('content.newArticle')}
          </button>
        </div>
      </div>

      {/* O9 — Vừa xem/sửa */}
      <RecentItemsChips items={recentContentItems} onSelect={(item) => navigate(`/admin/content/article/${item.id}`)} />

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

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
            title={t('content.emptyNoData', { defaultValue: 'Chưa có bài viết nào' })}
            description={t('content.emptyNoDataDesc', { defaultValue: 'Bắt đầu bằng cách tạo bài viết đầu tiên.' })}
            actionLabel={canUpdate ? t('content.newArticle') : undefined}
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
              rowHref={(item) => `/admin/content/${item.type.toLowerCase()}/${item.id}`}
              mobileCard={mobileCard}
              rowClassName={(item) => publishRowAccent(item.publishStatus)}
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
    </div>
  )
}
