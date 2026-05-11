import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Trash2, Upload, Grid as GridIcon, List as ListIcon, X as XIcon } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
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
import { showConfirm } from '../lib/confirm'
import {
  bulkDeleteMedia,
  bulkHardDeleteMedia,
  bulkMoveMedia,
  bulkRestoreMedia,
  deleteMedia,
  fetchMedia,
  fetchMediaFolders,
  fetchMediaStats,
  hardDeleteMedia,
  restoreMedia,
  uploadMedia,
} from '../lib/adminApi'
import { useDebounce } from '../lib/useDebounce'
import { useUrlSyncedState } from '../lib/useUrlSyncedState'
import { useDragDropUpload } from '../lib/useDragDropUpload'
import { useKeyboardNav } from '../lib/useKeyboardNav'
import styles from './MediaLibraryScreen.module.css'

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4',
]
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
const PAGE_SIZE_OPTIONS = [12, 24, 48, 96]

const DEFAULT_QUERY = {
  search: '', mimeType: 'ALL', status: 'ACTIVE', usageFilter: 'ALL',
  uploadedFrom: '', uploadedTo: '',
  minSize: '', maxSize: '',
  minWidth: '', minHeight: '',
  sort: 'createdAt', dir: 'desc',
  view: 'grid',
  folderFilter: '', tag: '',
  page: 1, pageSize: 24,
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatNumber(n) {
  return new Intl.NumberFormat('vi-VN').format(n ?? 0)
}

function dateToInstantStart(d) { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return Number.isNaN(x.getTime()) ? '' : x.toISOString() }
function dateToInstantEnd(d) { if (!d) return ''; const x = new Date(d + 'T00:00:00'); if (Number.isNaN(x.getTime())) return ''; x.setDate(x.getDate() + 1); return x.toISOString() }

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

  // Sidebar refresh signal — bumped when folder list might have changed (after bulk move, etc.)
  const [folderRefreshKey, setFolderRefreshKey] = useState(0)
  useEffect(() => { fetchMediaFolders().then(setFolders) }, [folderRefreshKey])
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
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [apiQuery])

  useEffect(() => {
    let active = true
    fetchMediaStats(apiQuery).then((s) => { if (active) setStats(s) })
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

  // ── Single delete / restore / hard delete ────────────────────
  async function handleDelete(mediaId) {
    const confirmed = await showConfirm(t('media.deleteConfirm'), t('media.deleteConfirmTitle'))
    if (!confirmed) return
    setDeleting(mediaId)
    try {
      await deleteMedia(mediaId)
      setState((p) => ({ ...p, items: p.items.filter((m) => m.id !== mediaId) }))
      toast.success(t('media.deleteSuccess'))
    } catch (e) { toast.error(e.message || t('media.deleteError')) }
    finally { setDeleting(null) }
  }

  async function handleRestore(mediaId) {
    setDeleting(mediaId)
    try {
      await restoreMedia(mediaId)
      setState((p) => ({ ...p, items: p.items.filter((m) => m.id !== mediaId) }))
      toast.success(t('media.restoreSuccess'))
    } catch (e) { toast.error(e.message || t('media.deleteError')) }
    finally { setDeleting(null) }
  }

  async function handleHardDelete(media) {
    const confirmed = await showConfirm(
      t('media.hardDeleteConfirm', { name: (media.filename ?? '').split('/').pop() }),
      t('media.hardDeleteConfirmTitle'))
    if (!confirmed) return
    setDeleting(media.id)
    try {
      await hardDeleteMedia(media.id)
      setState((p) => ({ ...p, items: p.items.filter((m) => m.id !== media.id) }))
      toast.success(t('media.hardDeleteSuccess'))
    } catch (e) { toast.error(e.message || t('media.deleteError')) }
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
    onHardDelete: canHardDelete ? () => handleHardDelete(media) : null,
  })

  const panelOpen = !!editingMedia

  return (
    <section
      className={`screen ${styles.dropzone} ${isDragging && canUpdate ? styles.dropzoneActive : ''} ${panelOpen ? styles.panelOpen : ''}`}
      ref={screenRef}
    >
      {isDragging && canUpdate && (
        <div className={styles.uploadOverlay}>
          <Upload size={48} />
          <span>{t('media.dropToUpload')}</span>
        </div>
      )}

      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('media.eyebrow')}</p>
          <h1>{t('media.title')}</h1>
          <p>{t('media.description')}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button"
            className={isTrash ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => updateQuery({ status: isTrash ? 'ACTIVE' : 'DELETED' })}
            title={t('media.trashShortcut')}>
            <Trash2 size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            {t('media.trashShortcut')}
          </button>
          {canUpdate && (
            <>
              <input ref={fileInputRef} type="file" multiple accept={ALLOWED_MIME.join(',')}
                style={{ display: 'none' }} onChange={handleFileChange} />
              <button type="button" className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                {t('common.upload')}
              </button>
            </>
          )}
        </div>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {/* Upload queue */}
      {uploadQueue.length > 0 && <UploadQueue queue={uploadQueue} onDismiss={(id) => setUploadQueue((q) => q.filter((u) => u.id !== id))} t={t} />}

      <div className={styles.layout}>
        <MediaFolderSidebar
          folderFilter={query.folderFilter}
          tag={query.tag}
          canUpdate={canUpdate}
          folders={folders}
          onFoldersChanged={() => setFolderRefreshKey((k) => k + 1)}
          onSelectFolder={(v) => updateQuery({ folderFilter: v })}
          onSelectTag={(v) => updateQuery({ tag: v })}
        />

        <div className={styles.mainCol} ref={dropZoneRef}>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <section className={styles.filterBar}>
        <label style={{ flex: '1 1 220px', minWidth: 200 }}>
          {t('common.search')}
          <div className={styles.searchWrap}>
            <input className="control-input" type="search" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('media.searchPlaceholder')}
              style={{ paddingRight: searchInput ? 32 : 12 }} />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')}
                aria-label={t('common.clear')} className={styles.searchClear}>
                <XIcon size={14} />
              </button>
            )}
          </div>
        </label>

        <label>
          {t('media.filterType')}
          <select className="control-select" value={query.mimeType}
            onChange={(e) => updateQuery({ mimeType: e.target.value })}>
            <option value="ALL">{t('media.allFiles')}{stats ? ` (${formatNumber(stats.total)})` : ''}</option>
            <option value="image/">{t('media.images')}{stats?.byMimeGroup?.image != null ? ` (${formatNumber(stats.byMimeGroup.image)})` : ''}</option>
            <option value="video/">{t('media.videos')}{stats?.byMimeGroup?.video != null ? ` (${formatNumber(stats.byMimeGroup.video)})` : ''}</option>
            <option value="audio/">{t('media.audios')}{stats?.byMimeGroup?.audio != null ? ` (${formatNumber(stats.byMimeGroup.audio)})` : ''}</option>
          </select>
        </label>

        <label>
          {t('media.filterUsage')}
          <select className="control-select" value={query.usageFilter}
            onChange={(e) => updateQuery({ usageFilter: e.target.value })}>
            <option value="ALL">{t('common.all')}{stats ? ` (${formatNumber(stats.total)})` : ''}</option>
            <option value="USED">{t('media.usageUsed')}{stats ? ` (${formatNumber(stats.used)})` : ''}</option>
            <option value="UNUSED">{t('media.usageUnusedOption')}{stats ? ` (${formatNumber(stats.unused)})` : ''}</option>
          </select>
        </label>

        <label>
          {t('common.sort')}
          <select className="control-select" value={`${query.sort}:${query.dir}`}
            onChange={(e) => { const [sort, dir] = e.target.value.split(':'); updateQuery({ sort, dir }) }}>
            <option value="createdAt:desc">{t('media.sortNewest')}</option>
            <option value="createdAt:asc">{t('media.sortOldest')}</option>
            <option value="fileSize:desc">{t('media.sortLargest')}</option>
            <option value="fileSize:asc">{t('media.sortSmallest')}</option>
            <option value="title:asc">{t('media.sortNameAZ')}</option>
            <option value="usageCount:desc">{t('media.sortMostUsed')}</option>
          </select>
        </label>

        <button type="button" className="btn btn-secondary" onClick={() => setShowAdvanced((s) => !s)}
          style={{ fontSize: '0.8rem' }}>
          {showAdvanced ? t('media.hideAdvanced') : t('media.showAdvanced')}
        </button>
      </section>

      {showAdvanced && (
        <section className={styles.filterBar}>
          <label>{t('media.uploadedFrom')}<input className="control-input" type="date" value={query.uploadedFrom} onChange={(e) => updateQuery({ uploadedFrom: e.target.value })} /></label>
          <label>{t('media.uploadedTo')}<input className="control-input" type="date" value={query.uploadedTo} onChange={(e) => updateQuery({ uploadedTo: e.target.value })} /></label>
          <label>{t('media.minSizeMB')}<input className="control-input" type="number" min="0" step="0.1"
            value={query.minSize ? (Number(query.minSize) / (1024 * 1024)).toFixed(1) : ''}
            onChange={(e) => updateQuery({ minSize: e.target.value ? Math.round(Number(e.target.value) * 1024 * 1024) : '' })}
            placeholder="0" /></label>
          <label>{t('media.maxSizeMB')}<input className="control-input" type="number" min="0" step="0.1"
            value={query.maxSize ? (Number(query.maxSize) / (1024 * 1024)).toFixed(1) : ''}
            onChange={(e) => updateQuery({ maxSize: e.target.value ? Math.round(Number(e.target.value) * 1024 * 1024) : '' })}
            placeholder="50" /></label>
          <label>{t('media.minWidthPx')}<input className="control-input" type="number" min="0" value={query.minWidth} onChange={(e) => updateQuery({ minWidth: e.target.value })} placeholder="1920" /></label>
          <label>{t('media.minHeightPx')}<input className="control-input" type="number" min="0" value={query.minHeight} onChange={(e) => updateQuery({ minHeight: e.target.value })} placeholder="1080" /></label>
        </section>
      )}

      {/* Toolbar: chips + summary + view switch */}
      <div className={styles.toolbarRow}>
        <FilterChips chips={activeChips} onClearAll={resetFilters} clearAllLabel={t('common.resetFilters')} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <p className={styles.resultSummary}>
            {state.pagination
              ? <>
                  {t('media.found')}: <strong>{formatNumber(state.pagination.total)}</strong>
                  {stats?.totalSizeBytes ? <span> · {formatBytes(stats.totalSizeBytes)}</span> : null}
                </>
              : ''}
          </p>
          <div className={styles.viewSwitcher} role="tablist">
            <button type="button" onClick={() => updateQuery({ view: 'grid' }, { resetPage: false })}
              className={query.view === 'grid' ? styles.active : ''}
              title={t('media.viewGrid')} aria-label={t('media.viewGrid')}>
              <GridIcon size={14} />
            </button>
            <button type="button" onClick={() => updateQuery({ view: 'list' }, { resetPage: false })}
              className={query.view === 'list' ? styles.active : ''}
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
          actions={isTrash ? [
            { label: t('media.bulkRestore'), onClick: handleBulkRestore, disabled: bulkBusy },
            ...(canHardDelete ? [{ label: t('media.bulkHardDelete'), onClick: handleBulkHardDelete, tone: 'danger', disabled: bulkBusy }] : []),
          ] : [
            { label: t('media.bulkMove'), onClick: () => setBulkMoveOpen(true), disabled: bulkBusy },
            { label: t('media.bulkDelete'), onClick: handleBulkDelete, tone: 'danger', disabled: bulkBusy },
            ...(canHardDelete ? [{ label: t('media.bulkHardDelete'), onClick: handleBulkHardDelete, tone: 'danger', disabled: bulkBusy }] : []),
          ]}
        />
      )}

      {/* Bulk move popover */}
      {bulkMoveOpen && (
        <div onClick={() => setBulkMoveOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--c-surface)', padding: 20, borderRadius: 8,
            minWidth: 320, maxWidth: '90vw',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>
              {t('media.bulkMoveTitle', { count: selectedIds.size })}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
              <button type="button" onClick={() => handleBulkMove(null)}
                disabled={bulkBusy} className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                — {t('media.uncategorized')} —
              </button>
              {folders.map((f) => (
                <button key={f.id} type="button" onClick={() => handleBulkMove(f.id)}
                  disabled={bulkBusy} className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                  {f.name} <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--c-text-muted)' }}>{f.mediaCount}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setBulkMoveOpen(false)}
              className="btn btn-secondary" style={{ width: '100%', marginTop: 12 }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {canUpdate && state.status === 'success' && state.items.length > 0 && (
        <div style={{ marginBottom: 8, fontSize: '0.8rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={allOnPageSelected}
              onChange={(e) => e.target.checked ? selectAllOnPage() : clearSelection()} />
            <span>{t('media.selectAllOnPage')}</span>
          </label>
        </div>
      )}

      {/* Grid / List */}
      {state.status === 'loading' && <MediaGridSkeleton count={Math.min(query.pageSize, 24)} />}
      {state.status === 'error' && <StatePanel tone="danger" title={t('media.loadError')} description={state.error}
        actionLabel={t('common.retry')} onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title={t('media.empty')} description={t('media.emptyDesc')}
          actionLabel={t('common.resetFilters')} onAction={resetFilters} />
      )}

      {state.status === 'success' && state.items.length > 0 && (
        <>
          {query.view === 'list' ? (
            <div className={styles.list} ref={gridRef}>
              <div className={styles.listHeader}>
                <span></span><span></span>
                <span>{t('media.colName')}</span>
                <span>{t('media.colSize')}</span>
                <span>{t('media.colDimensions')}</span>
                <span>{t('media.colDate')}</span>
                <span>{t('media.colUsage')}</span>
                <span style={{ textAlign: 'right' }}>{t('common.actions')}</span>
              </div>
              {state.items.map((m, i) => <MediaListRow key={m.id} {...rowProps(m, i)} />)}
            </div>
          ) : (
            <div className={styles.grid} ref={gridRef}>
              {state.items.map((m, i) => <MediaCard key={m.id} {...rowProps(m, i)} />)}
            </div>
          )}

          <div className={styles.paginationRow}>
            <PaginationControls pagination={state.pagination} onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
            <label className={styles.pageSizeWrap}>
              {t('common.pageSize')}
              <select className="control-select" value={query.pageSize}
                onChange={(e) => updateQuery({ pageSize: Number(e.target.value) })}>
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
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
    </section>
  )
}

// ── Upload queue panel ───────────────────────────────────────

function UploadQueue({ queue, onDismiss, t }) {
  const pending = queue.filter((u) => u.status === 'uploading' || u.status === 'pending').length
  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 50,
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      width: 360, maxHeight: 360, overflowY: 'auto',
    }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--c-border)', fontWeight: 700, fontSize: '0.85rem' }}>
        {pending > 0 ? t('media.uploading') + ` (${pending})` : t('media.uploadComplete', { count: queue.length })}
      </div>
      {queue.map((u) => (
        <div key={u.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--c-border)', fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={u.name}>{u.name}</span>
            <button type="button" onClick={() => onDismiss(u.id)} aria-label="Dismiss"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--c-text-muted)' }}>
              <XIcon size={12} />
            </button>
          </div>
          {u.status === 'error' ? (
            <p style={{ color: 'var(--c-danger)', margin: '4px 0 0 0', fontSize: '0.72rem' }}>{u.error}</p>
          ) : (
            <div style={{ height: 4, background: 'var(--c-bg-subtle)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${u.progress}%`,
                background: u.status === 'done' ? 'var(--c-success)' : 'var(--c-primary)',
                transition: 'width 0.2s',
              }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function hasAdvancedFilters(q) {
  return Boolean(q.uploadedFrom || q.uploadedTo || q.minSize || q.maxSize || q.minWidth || q.minHeight)
}

function buildActiveChips(query, t, folders, onRemove) {
  const chips = []
  if (query.search) chips.push({ key: 'search', label: `${t('common.search')}: ${query.search}`, onRemove: () => onRemove('search', '') })
  if (query.mimeType !== 'ALL') {
    const label = query.mimeType === 'image/' ? t('media.images')
      : query.mimeType === 'video/' ? t('media.videos')
      : query.mimeType === 'audio/' ? t('media.audios') : query.mimeType
    chips.push({ key: 'mimeType', label: `${t('media.filterType')}: ${label}`, onRemove: () => onRemove('mimeType', 'ALL') })
  }
  if (query.usageFilter !== 'ALL') {
    const label = query.usageFilter === 'USED' ? t('media.usageUsed') : t('media.usageUnusedOption')
    chips.push({ key: 'usageFilter', label: `${t('media.filterUsage')}: ${label}`, onRemove: () => onRemove('usageFilter', 'ALL') })
  }
  if (query.status !== DEFAULT_QUERY.status) {
    chips.push({ key: 'status', label: `${t('media.filterStatus')}: ${query.status === 'DELETED' ? t('media.statusDeleted') : t('media.statusActive')}`,
      onRemove: () => onRemove('status', DEFAULT_QUERY.status) })
  }
  if (query.uploadedFrom) chips.push({ key: 'uploadedFrom', label: `${t('media.uploadedFrom')}: ${query.uploadedFrom}`, onRemove: () => onRemove('uploadedFrom', '') })
  if (query.uploadedTo) chips.push({ key: 'uploadedTo', label: `${t('media.uploadedTo')}: ${query.uploadedTo}`, onRemove: () => onRemove('uploadedTo', '') })
  if (query.minSize) chips.push({ key: 'minSize', label: `≥ ${(Number(query.minSize) / 1024 / 1024).toFixed(1)} MB`, onRemove: () => onRemove('minSize', '') })
  if (query.maxSize) chips.push({ key: 'maxSize', label: `≤ ${(Number(query.maxSize) / 1024 / 1024).toFixed(1)} MB`, onRemove: () => onRemove('maxSize', '') })
  if (query.minWidth) chips.push({ key: 'minWidth', label: `${t('media.minWidthPx')} ${query.minWidth}`, onRemove: () => onRemove('minWidth', '') })
  if (query.minHeight) chips.push({ key: 'minHeight', label: `${t('media.minHeightPx')} ${query.minHeight}`, onRemove: () => onRemove('minHeight', '') })
  if (query.folderFilter) {
    const label = query.folderFilter === 'NONE' ? t('media.uncategorized')
      : (folders || []).find((f) => f.id === query.folderFilter)?.name ?? query.folderFilter
    chips.push({ key: 'folderFilter', label: `${t('media.folder')}: ${label}`, onRemove: () => onRemove('folderFilter', '') })
  }
  if (query.tag) chips.push({ key: 'tag', label: `#${query.tag}`, onRemove: () => onRemove('tag', '') })
  return chips
}
