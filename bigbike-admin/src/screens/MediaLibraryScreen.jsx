import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { Trash2, Upload, Grid as GridIcon, List as ListIcon, X as XIcon } from 'lucide-react'
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
import { MediaListRow } from '../components/MediaListRow'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { showConfirm } from '../lib/confirm'
import { recordRecentItem, useRecentItems } from '../lib/useRecentItems'
import {
  bulkDeleteMedia,
  bulkHardDeleteMedia,
  bulkMoveMedia,
  bulkRestoreMedia,
  deleteMedia,
  fetchMedia,
  fetchMediaFolders,
  fetchMediaReferences,
  fetchMediaStats,
  hardDeleteMedia,
  restoreMedia,
  uploadMedia,
} from '../lib/adminApi'
import { useDebounce } from '../lib/useDebounce'
import { useUrlSyncedState } from '../lib/useUrlSyncedState'
import { useDragDropUpload } from '../lib/useDragDropUpload'
import { useKeyboardNav } from '../lib/useKeyboardNav'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/layout/Modal'
import {
  ALLOWED_MIME,
  MAX_FILE_SIZE,
  PAGE_SIZE_OPTIONS,
  DEFAULT_QUERY,
  formatBytes,
  formatNumber,
  dateToInstantStart,
  dateToInstantEnd,
  hasAdvancedFilters,
  buildActiveChips,
} from './media-library/constants'
import { UploadQueue } from './media-library/UploadQueue'

export function MediaLibraryScreen({ canUpdate, canHardDelete = false }) {
  const { t } = useTranslation()
  const [query, setQuery] = useUrlSyncedState(DEFAULT_QUERY, {
    deserialize: { page: Number, pageSize: Number },
  })
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [stats, setStats] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [uploadQueue, setUploadQueue] = useState([]) // {id, name, progress, status, error}
  const [editingMedia, setEditingMedia] = useState(null)
  const [previewIndex, setPreviewIndex] = useState(null) // null = closed
  const [showAdvanced, setShowAdvanced] = useState(() => hasAdvancedFilters(query))
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [folders, setFolders] = useState([])

  // O9: file vừa mở gần đây (ghi lại mỗi khi mở panel chi tiết — màn này không có
  // route riêng theo id nên "mở chi tiết" đóng vai trò tương đương màn chi tiết).
  const recentMediaItems = useRecentItems('recent:media')
  useEffect(() => {
    if (editingMedia?.id) {
      recordRecentItem('recent:media', {
        id: editingMedia.id,
        label: (editingMedia.title || editingMedia.filename || editingMedia.publicUrl || '').split('/').pop() || editingMedia.id,
      })
    }
  }, [editingMedia])

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

  const apiQuery = useMemo(() => ({
    ...query,
    uploadedFrom: dateToInstantStart(query.uploadedFrom),
    uploadedTo: dateToInstantEnd(query.uploadedTo),
  }), [query])

  useEffect(() => {
    let active = true
    setState((p) => ({ ...p, status: 'loading' }))
    setSelectedIds(new Set())
    fetchMedia(apiQuery)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [apiQuery])

  useEffect(() => {
    let active = true
    fetchMediaStats(apiQuery)
      .then((s) => { if (active) setStats(s) })
      .catch((e) => { if (active) toast.error(e.message || t('common.error')) })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiQuery.search, apiQuery.mimeType, apiQuery.status, apiQuery.uploadedFrom, apiQuery.uploadedTo,
      apiQuery.minSize, apiQuery.maxSize, apiQuery.minWidth, apiQuery.minHeight])

  function updateQuery(partial, options = { resetPage: true }) {
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(DEFAULT_QUERY.search)
    setQuery({ ...DEFAULT_QUERY })
    setShowAdvanced(false)
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

    // Sequential upload to keep server happy and progress trackable
    for (const item of queue) {
      setUploadQueue((q) => q.map((u) => u.id === item.id ? { ...u, status: 'uploading' } : u))
      try {
        await uploadMedia(item.file, '', (pct) => {
          setUploadQueue((q) => q.map((u) => u.id === item.id ? { ...u, progress: pct } : u))
        })
        setUploadQueue((q) => q.map((u) => u.id === item.id ? { ...u, status: 'done', progress: 100 } : u))
      } catch (err) {
        setUploadQueue((q) => q.map((u) => u.id === item.id ? { ...u, status: 'error', error: err.message } : u))
        toast.error(t('media.uploadError') + ': ' + (err.message || ''))
      }
    }
    // Refresh list once everyone done
    setQuery((p) => ({ ...p }))
    toast.success(t('media.uploadComplete', { count: queue.length }))
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

  // Xoá item khỏi danh sách hiển thị nhưng GIỮ lại snapshot {item, index}
  // để có thể chèn lại đúng vị trí nếu server từ chối (rollback optimistic, tiêu chí 8.4).
  function removeItemLocally(mediaId) {
    let snapshot = null
    setState((p) => {
      const index = p.items.findIndex((m) => m.id === mediaId)
      if (index === -1) return p
      snapshot = { item: p.items[index], index }
      return { ...p, items: p.items.filter((m) => m.id !== mediaId) }
    })
    return snapshot
  }

  function restoreItemLocally(snapshot) {
    if (!snapshot) return
    setState((p) => {
      if (p.items.some((m) => m.id === snapshot.item.id)) return p
      const items = [...p.items]
      items.splice(Math.min(snapshot.index, items.length), 0, snapshot.item)
      return { ...p, items }
    })
  }

  // ── Single delete / restore / hard delete ────────────────────
  async function handleDelete(mediaId) {
    const confirmed = await showConfirm(t('media.deleteConfirm'), t('media.deleteConfirmTitle'))
    if (!confirmed) return
    setDeleting(mediaId)
    const snapshot = removeItemLocally(mediaId)
    try {
      await deleteMedia(mediaId)
      toast.success(t('media.deleteSuccess'))
    } catch (e) {
      restoreItemLocally(snapshot)
      toast.error(e.message || t('media.deleteError'))
    }
    finally { setDeleting(null) }
  }

  async function handleRestore(mediaId) {
    setDeleting(mediaId)
    const snapshot = removeItemLocally(mediaId)
    try {
      await restoreMedia(mediaId)
      toast.success(t('media.restoreSuccess'))
    } catch (e) {
      restoreItemLocally(snapshot)
      toast.error(e.message || t('media.deleteError'))
    }
    finally { setDeleting(null) }
  }

  async function handleHardDelete(media) {
    // Cảnh báo mạnh hơn cho hành động không thể hoàn tác: cho admin thấy số nơi
    // đang dùng file trước khi xoá vĩnh viễn khỏi kho (tiêu chí 7.6).
    let refCount = null
    try { refCount = (await fetchMediaReferences(media.id)).length } catch { /* không chặn xoá nếu không lấy được tham chiếu */ }
    const name = (media.filename ?? '').split('/').pop()
    const message = refCount && refCount > 0
      ? t('media.hardDeleteConfirmInUse', { name, count: refCount,
          defaultValue: `File "${name}" đang được dùng ở ${refCount} nơi. Xoá vĩnh viễn sẽ không thể hoàn tác và có thể làm hỏng các nơi đang dùng. Tiếp tục?` })
      : t('media.hardDeleteConfirm', { name })
    const confirmed = await showConfirm(message, t('media.hardDeleteConfirmTitle'))
    if (!confirmed) return
    setDeleting(media.id)
    const snapshot = removeItemLocally(media.id)
    try {
      await hardDeleteMedia(media.id)
      toast.success(t('media.hardDeleteSuccess'))
    } catch (e) {
      restoreItemLocally(snapshot)
      toast.error(e.message || t('media.deleteError'))
    }
    finally { setDeleting(null) }
  }

  // ── Bulk ─────────────────────────────────────────────────────
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    const confirmed = await showConfirm(
      t('media.bulkDeleteConfirm', { count: selectedIds.size }),
      t('media.bulkDeleteConfirmTitle'))
    if (!confirmed) return
    setBulkBusy(true)
    try {
      const affected = await bulkDeleteMedia([...selectedIds])
      setSelectedIds(new Set())
      setQuery((p) => ({ ...p }))
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
      setQuery((p) => ({ ...p }))
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
      setQuery((p) => ({ ...p }))
      setFolderRefreshKey((k) => k + 1)
      toast.success(t('media.bulkMoveSuccess', { count: affected }))
    } catch (e) { toast.error(e.message || t('media.deleteError')) }
    finally { setBulkBusy(false) }
  }

  async function handleBulkHardDelete() {
    if (selectedIds.size === 0) return
    const confirmed = await showConfirm(
      t('media.bulkHardDeleteConfirm', { count: selectedIds.size }),
      t('media.bulkHardDeleteConfirmTitle'))
    if (!confirmed) return
    setBulkBusy(true)
    try {
      const result = await bulkHardDeleteMedia([...selectedIds])
      setSelectedIds(new Set())
      setQuery((p) => ({ ...p }))
      if (result.blocked > 0) {
        toast.warning(t('media.bulkHardDeleteSummary', result))
      } else {
        toast.success(t('media.bulkHardDeleteSummary', result))
      }
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
    setState((p) => ({ ...p, items: p.items.map((m) => m.id === updated.id ? updated : m) }))
    setEditingMedia(null)
    setFolderRefreshKey((k) => k + 1)
  }

  // ── Render helpers ───────────────────────────────────────────
  const activeChips = buildActiveChips(query, t, folders, (key, val) => updateQuery({ [key]: val }))
  const allOnPageSelected = state.items.length > 0 && state.items.every((m) => selectedIds.has(m.id))
  const isTrash = query.status === 'DELETED'

  // Keyboard navigation: arrow keys to move focus, Space to select, Enter to open detail panel, Delete to delete
  const { focusIndex, setFocusIndex } = useKeyboardNav({
    count: state.items.length,
    gridRef,
    enabled: state.status === 'success' && previewIndex === null && !editingMedia,
    onActivate: (i) => { const m = state.items[i]; if (m) setEditingMedia(m) },
    onSelect: (i) => { const m = state.items[i]; if (m && canUpdate) toggleSelected(m.id) },
    onDelete: (i) => {
      const m = state.items[i]; if (!m || !canUpdate) return
      if (isTrash && canHardDelete) handleHardDelete(m)
      else if (!isTrash) handleDelete(m.id)
    },
  })

  const rowProps = (media, idx) => ({
    media,
    selected: selectedIds.has(media.id),
    focused: focusIndex === idx,
    deleting: deleting === media.id,
    onToggleSelect: canUpdate ? () => toggleSelected(media.id) : null,
    onPreview: () => { setPreviewIndex(idx); setFocusIndex(idx) },
    onEdit: canUpdate && !isTrash ? () => setEditingMedia(media) : null,
    onDelete: canUpdate && !isTrash ? () => handleDelete(media.id) : null,
    onRestore: canUpdate && isTrash ? () => handleRestore(media.id) : null,
    onHardDelete: canHardDelete && isTrash ? () => handleHardDelete(media) : null,
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

      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('media.eyebrow')}</p>
          <h1>{t('media.title')}</h1>
          <p className="bb-muted">{t('media.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <button
            type="button"
            className={isTrash ? 'bb-btn bb-btn-primary' : 'bb-btn bb-btn-secondary'}
            onClick={() => updateQuery({ status: isTrash ? 'ACTIVE' : 'DELETED' })}
            title={t('media.trashShortcut')}
          >
            <Trash2 size={14} />
            {t('media.trashShortcut')}
          </button>
          {canUpdate && (
            <>
              <input ref={fileInputRef} type="file" multiple accept={ALLOWED_MIME.join(',')}
                className="hidden" onChange={handleFileChange} />
              <button type="button" className="bb-btn bb-btn-primary" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} />
                {t('common.upload')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* O9 — Vừa xem gần đây */}
      <RecentItemsChips items={recentMediaItems} onSelect={(item) => {
        const found = state.items.find((m) => m.id === item.id)
        if (found) { setEditingMedia(found); return }
        // Không còn trên trang hiện tại (đổi trang/bộ lọc) — tìm lại theo tên file.
        setSearchInput(item.label)
      }} />

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {/* Gợi ý kích thước — kho dùng chung, nhắc admin chọn đúng kích thước theo mục đích */}
      <p className="text-xs text-muted-foreground -mt-1">{t('mediaReco.uploadGuide')}</p>

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
              <button type="button" onClick={() => setSearchInput('')}
                aria-label={t('common.clear')}
                className="medialib-search-clear focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-color-primary)]">
                <XIcon size={14} />
              </button>
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
            <SelectItem value="audio/">{t('media.audios')}{stats?.byMimeGroup?.audio != null ? ` (${formatNumber(stats.byMimeGroup.audio)})` : ''}</SelectItem>
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
            <SelectItem value="fileSize:desc">{t('media.sortLargest')}</SelectItem>
            <SelectItem value="fileSize:asc">{t('media.sortSmallest')}</SelectItem>
            <SelectItem value="title:asc">{t('media.sortNameAZ')}</SelectItem>
            <SelectItem value="usageCount:desc">{t('media.sortMostUsed')}</SelectItem>
          </SelectContent></Select>
        </label>

        <Button variant="outline" size="sm" onClick={() => setShowAdvanced((s) => !s)}>
          {showAdvanced ? t('media.hideAdvanced') : t('media.showAdvanced')}
        </Button>
      </section>

      {showAdvanced && (
        <section className="medialib-filter-bar">
          <label>{t('media.uploadedFrom')}<Input type="date" value={query.uploadedFrom} onChange={(e) => updateQuery({ uploadedFrom: e.target.value })}  /></label>
          <label>{t('media.uploadedTo')}<Input type="date" value={query.uploadedTo} onChange={(e) => updateQuery({ uploadedTo: e.target.value })}  /></label>
          <label>{t('media.minSizeMB')}<Input type="number" min="0" step="0.1"
            value={query.minSize ? (Number(query.minSize) / (1024 * 1024)).toFixed(1) : ''}
            onChange={(e) => updateQuery({ minSize: e.target.value ? Math.round(Number(e.target.value) * 1024 * 1024) : '' })}
            placeholder="0"  /></label>
          <label>{t('media.maxSizeMB')}<Input type="number" min="0" step="0.1"
            value={query.maxSize ? (Number(query.maxSize) / (1024 * 1024)).toFixed(1) : ''}
            onChange={(e) => updateQuery({ maxSize: e.target.value ? Math.round(Number(e.target.value) * 1024 * 1024) : '' })}
            placeholder="50"  /></label>
          <label>{t('media.minWidthPx')}<Input type="number" min="0" value={query.minWidth} onChange={(e) => updateQuery({ minWidth: e.target.value })} placeholder="1920"  /></label>
          <label>{t('media.minHeightPx')}<Input type="number" min="0" value={query.minHeight} onChange={(e) => updateQuery({ minHeight: e.target.value })} placeholder="1080"  /></label>
        </section>
      )}

      {/* Toolbar: chips + summary + view switch */}
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
            options={[24, 48, 96]}
          />
          <div className="medialib-view-switcher" role="tablist">
            <button type="button" onClick={() => updateQuery({ view: 'grid' }, { resetPage: false })}
              className={`focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--admin-color-primary)] ${query.view === 'grid' ? 'medialib-is-active' : ''}`}
              title={t('media.viewGrid')} aria-label={t('media.viewGrid')}>
              <GridIcon size={14} />
            </button>
            <button type="button" onClick={() => updateQuery({ view: 'list' }, { resetPage: false })}
              className={`focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--admin-color-primary)] ${query.view === 'list' ? 'medialib-is-active' : ''}`}
              title={t('media.viewList')} aria-label={t('media.viewList')}>
              <ListIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {canUpdate && selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={t('media.bulkSelected', { count: selectedIds.size })}
          onClear={clearSelection}
          closeLabel={t('common.clear')}
          actions={isTrash ? [
            { label: t('media.bulkRestore'), onClick: handleBulkRestore, disabled: bulkBusy },
            ...(canHardDelete ? [{ label: t('media.bulkHardDelete'), onClick: handleBulkHardDelete, tone: 'danger', disabled: bulkBusy }] : []),
          ] : [
            { label: t('media.bulkMove'), onClick: () => setBulkMoveOpen(true), disabled: bulkBusy },
            { label: t('media.bulkDelete'), onClick: handleBulkDelete, tone: 'danger', disabled: bulkBusy },
          ]}
        />
      )}

      {/* Bulk move dialog */}
      <Modal
        open={bulkMoveOpen}
        onClose={() => setBulkMoveOpen(false)}
        title={t('media.bulkMoveTitle', { count: selectedIds.size })}
        closeLabel={t('common.close')}
        actions={
          <Button variant="outline" onClick={() => setBulkMoveOpen(false)}>
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
        actionLabel={t('common.retry')} onAction={() => setQuery((p) => ({ ...p }))} />}
      {/* T2 — chỉ hiện CTA "Xoá bộ lọc" khi thực sự có bộ lọc đang áp dụng; kho
          thật sự trống (chưa từng upload) thì mời admin tải file lên thay vì gợi
          ý xoá một bộ lọc không tồn tại. */}
      {state.status === 'success' && state.items.length === 0 && (
        activeChips.length > 0 ? (
          <StatePanel tone="neutral" title={t('media.empty')} description={t('media.emptyDesc')}
            actionLabel={t('common.resetFilters')} onAction={resetFilters} />
        ) : (
          <StatePanel tone="neutral" title={t('media.empty')} description={t('media.emptyLibraryDesc', { defaultValue: 'Thư viện chưa có file nào. Tải file lên để bắt đầu.' })}
            actionLabel={canUpdate ? t('common.upload') : undefined}
            onAction={canUpdate ? () => fileInputRef.current?.click() : undefined} />
        )
      )}

      {state.status === 'success' && state.items.length > 0 && (
        <>
          {query.view === 'list' ? (
            <div className="medialib-list" ref={gridRef}>
              <div className="medialib-list-header sticky top-0 z-10">
                <span></span><span></span>
                <span>{t('media.colName')}</span>
                <span>{t('media.colSize')}</span>
                <span>{t('media.colDimensions')}</span>
                <span>{t('media.colDate')}</span>
                <span>{t('media.colUsage')}</span>
                <span className="text-right">{t('common.actions')}</span>
              </div>
              {state.items.map((m, i) => <MediaListRow key={m.id} {...rowProps(m, i)} />)}
            </div>
          ) : (
            <div className="medialib-grid" ref={gridRef}>
              {state.items.map((m, i) => <MediaCard key={m.id} {...rowProps(m, i)} />)}
            </div>
          )}

          <div className="medialib-pagination-row">
            <PaginationControls pagination={state.pagination} onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
            <label className="medialib-page-size-wrap">
              {t('common.pageSize')}
              <Select value={query.pageSize}
                onValueChange={(val) => updateQuery({ pageSize: Number(val) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent></Select>
            </label>
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
          folders={folders}
          onSaved={handleMediaSaved}
          onClose={() => setEditingMedia(null)}
          onPreview={() => {
            const idx = state.items.findIndex((m) => m.id === editingMedia.id)
            if (idx >= 0) setPreviewIndex(idx)
          }}
          onDelete={async () => { await handleDelete(editingMedia.id); setEditingMedia(null) }}
          onRestore={async () => { await handleRestore(editingMedia.id); setEditingMedia(null) }}
          onHardDelete={async () => { await handleHardDelete(editingMedia); setEditingMedia(null) }}
        />
      )}
      {previewIndex !== null && state.items[previewIndex] && (
        <MediaPreviewLightbox
          items={state.items}
          index={previewIndex}
          onNavigate={(i) => setPreviewIndex(i)}
          onClose={() => setPreviewIndex(null)} />
      )}
    </div>
  )
}
