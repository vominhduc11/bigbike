import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { RefreshCw, Trash2, Upload, X as XIcon } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { MediaDetailPanel } from '../components/MediaDetailPanel'
import { MediaPreviewLightbox } from '../components/MediaPreviewLightbox'
import { MediaFolderSidebar } from '../components/MediaFolderSidebar'
import { FilterChips } from '../components/FilterChips'
import { BulkActionBar } from '../components/BulkActionBar'
import { MediaGridSkeleton } from '../components/MediaCardSkeleton'
import { MediaCard } from '../components/MediaCard'
import { showConfirm } from '../lib/confirm'
import {
  bulkDeleteMedia,
  bulkMoveMedia,
  bulkRestoreMedia,
  deleteMedia,
  downloadMedia,
  fetchMedia,
  fetchMediaFolders,
  fetchMediaReferences,
  fetchMediaStats,
  hardDeleteMedia,
  restoreMedia,
  uploadMedia,
} from '../lib/adminApi'
import { isDownloadableMedia } from '../lib/contracts'
import { useDebounce } from '../lib/useDebounce'
import { useUrlSyncedState } from '../lib/useUrlSyncedState'
import { useDragDropUpload } from '../lib/useDragDropUpload'
import { useKeyboardNav } from '../lib/useKeyboardNav'
import { sendAdminWs } from '../lib/adminWebSocket'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/layout/Modal'
import { ScreenHeader } from '@/components/layout'
import {
  ALLOWED_MIME,
  MAX_FILE_SIZE,
  PAGE_SIZE_OPTIONS,
  DEFAULT_QUERY,
  formatBytes,
  formatNumber,
  buildActiveChips,
} from './media-library/constants'
import { UploadQueue } from './media-library/UploadQueue'

function mediaActionError(t, error, fallback) {
  if (error?.status === 403) return t('media.actionForbidden')
  if (error?.status === 404) return t('media.actionNotFound')
  if (error?.status === 409) return error.message || t('media.actionConflict')
  if (error?.status === 0 || error?.code === 'NETWORK_ERROR') return t('media.actionNetworkError')
  return error?.message || fallback
}

export function MediaLibraryScreen({ canUpdate, canHardDelete = false }) {
  const { t } = useTranslation()
  const [query, setQuery] = useUrlSyncedState(DEFAULT_QUERY, {
    deserialize: { page: Number, pageSize: Number },
  })
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, error: '', refreshError: '' })
  const [stats, setStats] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [uploadQueue, setUploadQueue] = useState([]) // {id, name, progress, status, error}
  const [editingMedia, setEditingMedia] = useState(null)
  const [previewIndex, setPreviewIndex] = useState(null) // null = closed
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [folders, setFolders] = useState([])
  const [dataRevision, setDataRevision] = useState(0)

  // Sidebar refresh signal — bumped when folder list might have changed (after bulk move, etc.)
  const [folderRefreshKey, setFolderRefreshKey] = useState(0)
  useEffect(() => {
    fetchMediaFolders()
      .then(setFolders)
      .catch((e) => toast.error(e.message || t('common.error')))
  }, [folderRefreshKey, t])
  const fileInputRef = useRef(null)
  const screenRef = useRef(null)
  const dropZoneRef = useRef(null)
  const gridRef = useRef(null)

  const [searchInput, setSearchInput] = useState(query.search)
  const debouncedSearch = useDebounce(searchInput, 400)
  const isFirstSearchRender = useRef(true)

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((p) => ({ ...p, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // URL back/forward, reset filter và nút bỏ chip đều có thể đổi query.search
  // bên ngoài ô nhập. Đồng bộ lại để từ khoá cũ không tự xuất hiện trở lại sau debounce.
  useEffect(() => {
    setSearchInput(query.search ?? '')
  }, [query.search])

  const apiQuery = query

  useEffect(() => {
    let active = true
    setState((p) => ({
      ...p,
      status: p.items.length > 0 ? 'refreshing' : 'loading',
      error: '',
      refreshError: '',
    }))
    setSelectedIds(new Set())
    fetchMedia(apiQuery)
      .then((r) => {
        if (!active) return
        const totalPages = Math.max(1, Number(r.pagination?.totalPages) || 1)
        if (apiQuery.page > totalPages) {
          setQuery((p) => ({ ...p, page: totalPages }))
          return
        }
        setState({ status: 'success', items: r.items, pagination: r.pagination, error: '', refreshError: '' })
      })
      .catch((e) => {
        if (!active) return
        setState((p) => p.items.length > 0
          ? { ...p, status: 'success', refreshError: e.message || 'refresh-failed', error: '' }
          : { status: 'error', items: [], pagination: null, error: e.message || '', refreshError: '' })
      })
    return () => { active = false }
  }, [apiQuery, dataRevision, setQuery])

  useEffect(() => {
    let active = true
    fetchMediaStats(apiQuery)
      .then((s) => { if (active) setStats(s) })
      .catch((e) => { if (active) toast.error(e.message || t('common.error')) })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiQuery.search, apiQuery.mimeType, apiQuery.status, apiQuery.folderFilter, apiQuery.tag, dataRevision, t])

  function refreshData({ foldersChanged = false } = {}) {
    setDataRevision((revision) => revision + 1)
    if (foldersChanged) setFolderRefreshKey((key) => key + 1)
  }

  function updateQuery(partial, options = { resetPage: true }) {
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(DEFAULT_QUERY.search)
    setQuery((current) => ({ ...DEFAULT_QUERY, pageSize: current.pageSize }))
  }

  // ── Upload (single + multi + drag-drop) ─────────────────────
  async function uploadFiles(files) {
    if (!canUpdate || files.length === 0) return
    const valid = []
    for (const file of files) {
      if (!ALLOWED_MIME.includes(file.type)) {
        toast.error(t('media.unsupportedType', { type: file.type })); continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t('media.fileTooLarge', { size: formatBytes(file.size), limit: formatBytes(MAX_FILE_SIZE) })); continue
      }
      valid.push(file)
    }
    if (valid.length === 0) return

    const queue = valid.map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, file: f, progress: 0, status: 'pending' }))
    setUploadQueue((q) => [...q, ...queue])

    // Upload thẳng vào thư mục đang mở. "Chưa phân loại" cũng là 1 đích rõ ràng (khác
    // "Tất cả" — không đích nào) nên cần cờ riêng để phân biệt, xem ghi chú ở uploadMedia().
    const targetFolderId = query.folderFilter && query.folderFilter !== 'NONE' ? query.folderFilter : null
    const targetClearFolder = query.folderFilter === 'NONE'

    // Sequential upload to keep server happy and progress trackable
    let succeeded = 0
    let failed = 0
    for (const item of queue) {
      sendAdminWs('/app/admin/maintenance/uploads', { uploadId: item.id, status: 'PENDING' })
      setUploadQueue((q) => q.map((u) => u.id === item.id ? { ...u, status: 'uploading' } : u))
      sendAdminWs('/app/admin/maintenance/uploads', { uploadId: item.id, status: 'UPLOADING' })
      try {
        await uploadMedia(item.file, '', (pct) => {
          setUploadQueue((q) => q.map((u) => u.id === item.id ? { ...u, progress: pct } : u))
        }, targetFolderId, targetClearFolder)
        setUploadQueue((q) => q.map((u) => u.id === item.id ? { ...u, status: 'done', progress: 100 } : u))
        sendAdminWs('/app/admin/maintenance/uploads', { uploadId: item.id, status: 'DONE' })
        succeeded += 1
      } catch (err) {
        setUploadQueue((q) => q.map((u) => u.id === item.id ? { ...u, status: 'error', error: err.message } : u))
        sendAdminWs('/app/admin/maintenance/uploads', { uploadId: item.id, status: 'ERROR' })
        failed += 1
      }
    }
    // Refresh list once everyone done — về trang 1 để ảnh/video mới (luôn ở đầu theo sort
    // mặc định createdAt desc) không bị kẹt ngoài tầm nhìn nếu admin đang ở trang khác.
    setQuery((p) => ({ ...p, page: 1 }))
    refreshData({ foldersChanged: true })
    // Báo đúng số thành công / lỗi thay vì luôn "hoàn tất N" kể cả khi có lỗi (P1-12).
    if (failed === 0) {
      toast.success(t('media.uploadComplete', { count: succeeded }))
    } else {
      toast.warning(t('media.uploadPartial', { ok: succeeded, fail: failed, defaultValue: 'Lên {{ok}} tệp, {{fail}} lỗi.' }))
    }
    // Auto-clear successful uploads after 3s
    setTimeout(() => setUploadQueue((q) => q.filter((u) => u.status !== 'done')), 3000)
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    uploadFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Bind drag-drop to the main content column only — never the right-side detail
  // panel. Otherwise dragging a file over the panel would trigger an upload overlay.
  const { isDragging } = useDragDropUpload(dropZoneRef, uploadFiles)

  // ── Single delete / restore / hard delete ────────────────────
  async function handleDelete(media) {
    if (!media?.id) return false
    const name = (media.title || media.filename || media.id).split('/').pop()
    const confirmed = await showConfirm(
      t('media.deleteConfirm', { name }),
      t('common.moveToTrashTitle'),
      { variant: 'default', confirmLabel: t('common.moveToTrash') },
    )
    if (!confirmed) return false
    setDeleting(media.id)
    try {
      await deleteMedia(media.id)
      toast.success(t('media.deleteSuccess'))
      refreshData({ foldersChanged: true })
      return true
    } catch (e) {
      toast.error(mediaActionError(t, e, t('media.deleteError')))
      refreshData({ foldersChanged: true })
      return false
    }
    finally { setDeleting(null) }
  }

  async function handleRestore(mediaId) {
    setDeleting(mediaId)
    try {
      await restoreMedia(mediaId)
      toast.success(t('media.restoreSuccess'))
      refreshData({ foldersChanged: true })
      return true
    } catch (e) {
      toast.error(mediaActionError(t, e, t('media.deleteError')))
      refreshData({ foldersChanged: true })
      return false
    }
    finally { setDeleting(null) }
  }

  async function handleDownload(media) {
    try {
      await downloadMedia(media.id, media.originalFilename || media.filename)
    } catch (e) {
      toast.error(mediaActionError(t, e, t('media.downloadError')))
    }
  }

  async function handleHardDelete(media) {
    // Cảnh báo mạnh hơn cho hành động không thể hoàn tác: cho admin thấy số nơi
    // đang dùng file trước khi xoá vĩnh viễn khỏi kho (tiêu chí 7.6).
    let refCount = null
    try { refCount = (await fetchMediaReferences(media.id)).length }
    catch {
      toast.error(t('media.hardDeleteReferenceCheckError'))
      return false
    }
    const name = (media.filename ?? '').split('/').pop()
    if (refCount && refCount > 0) {
      toast.error(t('media.hardDeleteBlockedInUse', { name, count: refCount }))
      return false
    }
    const confirmed = await showConfirm(
      t('media.hardDeleteConfirm', { name }),
      t('common.permanentDeleteTitle'),
      { variant: 'danger', confirmLabel: t('common.permanentDelete') },
    )
    if (!confirmed) return false
    setDeleting(media.id)
    try {
      await hardDeleteMedia(media.id)
      toast.success(t('media.hardDeleteSuccess'))
      refreshData({ foldersChanged: true })
      return true
    } catch (e) {
      toast.error(mediaActionError(t, e, t('media.hardDeleteError')))
      refreshData({ foldersChanged: true })
      return false
    }
    finally { setDeleting(null) }
  }

  // ── Bulk ─────────────────────────────────────────────────────
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    const confirmed = await showConfirm(
      t('media.bulkDeleteConfirm', { count: selectedIds.size }),
      t('common.moveToTrashTitle'),
      { variant: 'default', confirmLabel: t('common.moveToTrash') },
    )
    if (!confirmed) return
    setBulkBusy(true)
    try {
      const affected = await bulkDeleteMedia([...selectedIds])
      setSelectedIds(new Set())
      refreshData({ foldersChanged: true })
      toast.success(t('media.bulkDeleteSuccess', { count: affected }))
    } catch (e) { toast.error(e.message || t('media.deleteError')) }
    finally { setBulkBusy(false) }
  }

  async function handleBulkRestore() {
    if (selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const affected = await bulkRestoreMedia([...selectedIds])
      setSelectedIds(new Set())
      refreshData({ foldersChanged: true })
      toast.success(t('media.bulkRestoreSuccess', { count: affected }))
    } catch (e) { toast.error(e.message || t('media.deleteError')) }
    finally { setBulkBusy(false) }
  }

  async function handleBulkMove(folderId) {
    if (selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const affected = await bulkMoveMedia([...selectedIds], folderId || null)
      setSelectedIds(new Set())
      setBulkMoveOpen(false)
      refreshData({ foldersChanged: true })
      toast.success(t('media.bulkMoveSuccess', { count: affected }))
    } catch (e) { toast.error(e.message || t('media.deleteError')) }
    finally { setBulkBusy(false) }
  }

  // ── Selection ────────────────────────────────────────────────
  function toggleSelected(id) {
    setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAllOnPage() {
    setSelectedIds((p) => { const n = new Set(p); state.items.forEach((m) => n.add(m.id)); return n })
  }
  function clearSelection() { setSelectedIds(new Set()) }

  function handleMediaSaved(updated) {
    const folderChanged = editingMedia && editingMedia.folderId !== updated.folderId
    setState((p) => ({ ...p, items: p.items.map((m) => m.id === updated.id ? updated : m) }))
    setEditingMedia(null)
    // Đổi folder qua panel chi tiết: nếu đang lọc theo 1 thư mục, item có thể không còn
    // khớp filter nữa — cần refetch để nó biến mất khỏi view, giống hành vi bulk-move.
    if (folderChanged) refreshData({ foldersChanged: true })
    else setFolderRefreshKey((k) => k + 1)
  }

  // ── Render helpers ───────────────────────────────────────────
  const activeChips = buildActiveChips(query, t, folders, (key, val) => updateQuery({ [key]: val }))
  const allOnPageSelected = state.items.length > 0 && state.items.every((m) => selectedIds.has(m.id))
  const isTrash = query.status === 'DELETED'
  const isRefreshing = state.status === 'refreshing'

  // Keyboard navigation: arrow keys to move focus, Space to select, Enter to open detail panel, Delete to delete
  const { focusIndex, setFocusIndex } = useKeyboardNav({
    count: state.items.length,
    gridRef,
    enabled: state.status === 'success' && previewIndex === null && !editingMedia,
    onActivate: (i) => { const m = state.items[i]; if (m) setEditingMedia(m) },
    onSelect: (i) => { const m = state.items[i]; if (m && canUpdate) toggleSelected(m.id) },
    onDelete: (i) => {
      const m = state.items[i]; if (!m || !canUpdate || isTrash) return
      handleDelete(m)
    },
  })

  // Xoá vĩnh viễn KHÔNG có mặt trên thẻ ảnh — chỉ trong bảng chi tiết khi đang ở
  // Thùng rác, để hành động không hoàn tác được luôn đi kèm cảnh báo "đang dùng ở đâu".
  const cardProps = (media, idx) => ({
    media,
    selected: selectedIds.has(media.id),
    focused: focusIndex === idx,
    deleting: deleting === media.id,
    onToggleSelect: canUpdate && !isRefreshing ? () => toggleSelected(media.id) : null,
    onPreview: () => { setPreviewIndex(idx); setFocusIndex(idx) },
    onEdit: canUpdate && !isRefreshing && !isTrash ? () => setEditingMedia(media) : null,
    onViewDetail: !isRefreshing && (isTrash || !canUpdate) ? () => setEditingMedia(media) : null,
    onDelete: canUpdate && !isRefreshing && !isTrash ? () => handleDelete(media) : null,
    onRestore: canUpdate && !isRefreshing && isTrash ? () => handleRestore(media.id) : null,
    onDownload: !isRefreshing && isDownloadableMedia(media) ? () => handleDownload(media) : null,
  })

  const panelOpen = !!editingMedia

  return (
    <div
      className={`medialib-dropzone ${isDragging && canUpdate ? 'medialib-dropzone-active' : ''} ${panelOpen ? 'medialib-panel-open' : ''}`}
      ref={screenRef}
    >
      {isDragging && canUpdate && (
        <div className="medialib-upload-overlay">
          <Upload size={48} />
          <span>{t('media.dropToUpload')}</span>
        </div>
      )}

      <ScreenHeader
        eyebrow={t('media.eyebrow')}
        title={t('media.title')}
        description={t('media.description')}
        actions={(
          <>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={isRefreshing}
            onClick={() => refreshData()}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : undefined} aria-hidden="true" />
            {t('common.refresh')}
          </Button>
          <Button variant="unstyled"
            type="button"
            className={isTrash ? 'bb-btn bb-btn-primary' : 'bb-btn bb-btn-secondary'}
            onClick={() => updateQuery({ status: isTrash ? 'ACTIVE' : 'DELETED' })}
            disabled={isRefreshing}
            title={t('media.trashShortcut')}
          >
            <Trash2 size={14} />
            {t('media.trashShortcut')}
          </Button>
          {canUpdate && (
            <>
              <input ref={fileInputRef} type="file" multiple accept={ALLOWED_MIME.join(',')}
                className="hidden" onChange={handleFileChange} />
              <Button type="button" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} />
                {t('common.upload')}
              </Button>
            </>
          )}
          </>
        )}
      />

      {!canUpdate ? <ReadOnlyBanner warning={t('media.readOnly')} /> : null}

      {/* Upload queue */}
      {uploadQueue.length > 0 && <UploadQueue queue={uploadQueue} onDismiss={(id) => setUploadQueue((q) => q.filter((u) => u.id !== id))} />}

      <div className="medialib-layout">
        <MediaFolderSidebar
          folderFilter={query.folderFilter}
          tag={query.tag}
          canUpdate={canUpdate}
          folders={folders}
          onFoldersChanged={() => setFolderRefreshKey((k) => k + 1)}
          onSelectFolder={(v) => updateQuery({ folderFilter: v })}
          onSelectTag={(v) => updateQuery({ tag: v })}
        />

        <div className="medialib-main-col" ref={dropZoneRef}>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <section className="medialib-filter-bar">
        <label className="flex-[1_1_220px] min-w-[200px]">
          {t('common.search')}
          <div className="medialib-search-wrap">
            <Input type="search" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('media.searchPlaceholder')}
              className={searchInput ? 'pr-8' : 'pr-3'}  />
            {searchInput && (
              <Button variant="unstyled" type="button" onClick={() => setSearchInput('')}
                aria-label={t('common.clear')}
                className="medialib-search-clear focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-color-primary)]">
                <XIcon size={14} />
              </Button>
            )}
          </div>
        </label>

        <label>
          {t('media.filterType')}
          <Select value={query.mimeType}
            onValueChange={(val) => updateQuery({ mimeType: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">{t('media.allFiles')}{stats ? ` (${formatNumber(stats.total)})` : ''}</SelectItem>
            <SelectItem value="image/">{t('media.images')}{stats?.byMimeGroup?.image != null ? ` (${formatNumber(stats.byMimeGroup.image)})` : ''}</SelectItem>
            <SelectItem value="video/">{t('media.videos')}{stats?.byMimeGroup?.video != null ? ` (${formatNumber(stats.byMimeGroup.video)})` : ''}</SelectItem>
          </SelectContent></Select>
        </label>

        <label>
          {t('media.filterUsage')}
          <Select value={query.usageFilter}
            onValueChange={(val) => updateQuery({ usageFilter: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">{t('common.all')}{stats ? ` (${formatNumber(stats.total)})` : ''}</SelectItem>
            <SelectItem value="USED">{t('media.usageUsed')}{stats ? ` (${formatNumber(stats.used)})` : ''}</SelectItem>
            <SelectItem value="UNUSED">{t('media.usageUnusedOption')}{stats ? ` (${formatNumber(stats.unused)})` : ''}</SelectItem>
          </SelectContent></Select>
        </label>

        <label>
          {t('common.sort')}
          <Select value={`${query.sort}:${query.dir}`}
            onValueChange={(val) => { const [sort, dir] = val.split(':'); updateQuery({ sort, dir }) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="createdAt:desc">{t('media.sortNewest')}</SelectItem>
            <SelectItem value="createdAt:asc">{t('media.sortOldest')}</SelectItem>
            <SelectItem value="title:asc">{t('media.sortNameAZ')}</SelectItem>
          </SelectContent></Select>
        </label>
      </section>

      {/* Toolbar: chips + summary */}
      <div className="medialib-toolbar-row">
        <FilterChips
          chips={activeChips}
          onClearAll={resetFilters}
          clearAllLabel={t('common.resetFilters')}
          removeChipLabel={t('common.clear')}
        />
        <div className="flex items-center gap-3 ml-auto">
          <p className="medialib-result-summary">
            {state.pagination
              ? <>
                  {t('media.found')}: <strong>{formatNumber(state.pagination.totalItems)}</strong>
                  {stats?.totalSizeBytes && stats.sizeKnownCount >= (state.pagination?.totalItems ?? 0) * 0.5
                    ? <span> · {formatBytes(stats.totalSizeBytes)}</span>
                    : null}
                </>
              : ''}
          </p>
          <PageSizeSelect
            value={query.pageSize}
            onChange={(n) => updateQuery({ pageSize: n })}
            options={PAGE_SIZE_OPTIONS}
          />
        </div>
      </div>

      {isRefreshing ? (
        <p className="mb-3 text-sm text-muted-foreground" role="status" aria-live="polite">
          {t('media.refreshing')}
        </p>
      ) : null}
      {state.refreshError ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
          <span>{t('media.refreshError')}</span>
          <Button type="button" variant="secondary" size="sm" onClick={() => refreshData()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {/* Bulk action bar */}
      {canUpdate && selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={t('media.bulkSelected', { count: selectedIds.size })}
          onClear={clearSelection}
          closeLabel={t('common.clear')}
          actions={isTrash ? [
            { label: t('media.bulkRestore'), onClick: handleBulkRestore, disabled: bulkBusy },
          ] : [
            { label: t('media.bulkMove'), onClick: () => setBulkMoveOpen(true), disabled: bulkBusy },
            { label: t('media.bulkDelete'), onClick: handleBulkDelete, tone: 'danger', disabled: bulkBusy },
          ]}
        />
      )}

      {/* Bulk move dialog */}
      <Modal
        open={bulkMoveOpen}
        onClose={() => { if (!bulkBusy) setBulkMoveOpen(false) }}
        title={t('media.bulkMoveTitle', { count: selectedIds.size })}
        closeLabel={t('common.close')}
        actions={
          <Button variant="outline" onClick={() => setBulkMoveOpen(false)} disabled={bulkBusy}>
            {t('common.cancel')}
          </Button>
        }
      >
        <div className="flex flex-col gap-1">
          <Button variant="outline" onClick={() => handleBulkMove(null)}
            disabled={bulkBusy} className="justify-start text-left">
            — {t('media.uncategorized')} —
          </Button>
          {folders.map((f) => (
            <Button key={f.id} variant="outline" onClick={() => handleBulkMove(f.id)}
              disabled={bulkBusy} className="justify-start text-left">
              {f.name} <span className="ml-auto text-xs text-muted-foreground">{f.mediaCount}</span>
            </Button>
          ))}
        </div>
      </Modal>

      {canUpdate && state.status === 'success' && state.items.length > 0 && (
        <div className="mb-2 text-xs">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={allOnPageSelected}
              onCheckedChange={(checked) => checked ? selectAllOnPage() : clearSelection()}  />
            <span>{t('media.selectAllOnPage')}</span>
          </label>
        </div>
      )}

      {/* Grid / List */}
      {state.status === 'loading' && <MediaGridSkeleton count={Math.min(query.pageSize, 24)} />}
      {state.status === 'error' && <StatePanel tone="danger" title={t('media.loadError')} description={state.error}
        actionLabel={t('common.retry')} onAction={() => refreshData()} />}
      {/* T2 — chỉ hiện CTA "Xoá bộ lọc" khi thực sự có bộ lọc đang áp dụng; kho
          thật sự trống (chưa từng upload) thì mời admin tải file lên thay vì gợi
          ý xoá một bộ lọc không tồn tại. */}
      {state.status === 'success' && state.items.length === 0 && (
        activeChips.length > 0 ? (
          <StatePanel tone="neutral" title={t('media.empty')} description={t('media.emptyDesc')}
            actionLabel={t('common.resetFilters')} onAction={resetFilters} />
        ) : (
          <StatePanel tone="neutral" title={t('media.empty')} description={t('media.emptyLibraryDesc', { defaultValue: 'Thư viện chưa có tệp nào. Tải tệp lên để bắt đầu.' })}
            actionLabel={canUpdate ? t('common.upload') : undefined}
            onAction={canUpdate ? () => fileInputRef.current?.click() : undefined} />
        )
      )}

      {(state.status === 'success' || state.status === 'refreshing') && state.items.length > 0 && (
        <>
          <div className="medialib-grid" ref={gridRef} aria-busy={isRefreshing || undefined}>
            {state.items.map((m, i) => <MediaCard key={m.id} {...cardProps(m, i)} />)}
          </div>

          {/* Số mỗi trang chỉ còn 1 chỗ duy nhất — bộ chọn ở thanh công cụ phía trên
              (PageSizeSelect). Bỏ bản lặp cạnh phân trang để tránh 2 control cùng chức năng. */}
          <div className="medialib-pagination-row">
            <PaginationControls pagination={state.pagination} disabled={isRefreshing} onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
          </div>
        </>
      )}
        </div>
      </div>

      {editingMedia && (
        <MediaDetailPanel
          media={editingMedia}
          canUpdate={canUpdate}
          canHardDelete={canHardDelete}
          actionBusy={deleting === editingMedia.id}
          folders={folders}
          onSaved={handleMediaSaved}
          onClose={() => setEditingMedia(null)}
          onDownload={isDownloadableMedia(editingMedia) ? handleDownload : null}
          onPreview={() => {
            const idx = state.items.findIndex((m) => m.id === editingMedia.id)
            if (idx >= 0) setPreviewIndex(idx)
          }}
          onDelete={async () => { if (await handleDelete(editingMedia)) setEditingMedia(null) }}
          onRestore={async () => { if (await handleRestore(editingMedia.id)) setEditingMedia(null) }}
          onHardDelete={async () => { if (await handleHardDelete(editingMedia)) setEditingMedia(null) }}
        />
      )}
      {previewIndex !== null && state.items[previewIndex] && (
        <MediaPreviewLightbox
          items={state.items}
          index={previewIndex}
          onNavigate={(i) => setPreviewIndex(i)}
          onDownload={isDownloadableMedia(state.items[previewIndex]) ? handleDownload : null}
          onClose={() => setPreviewIndex(null)} />
      )}
    </div>
  )
}
