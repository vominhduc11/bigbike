import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Inbox,
  Hash,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { showConfirm } from '../lib/confirm'
import {
  createMediaFolder,
  deleteMediaFolder,
  fetchMediaTags,
  updateMediaFolder,
} from '../lib/adminApi'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getMediaFolderLabel } from '@/lib/mediaFolderUtils'

function buildFolderTree(folders) {
  const byParent = new Map()
  for (const folder of folders) {
    const key = folder.parentId || null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(folder)
  }
  for (const children of byParent.values()) {
    children.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'))
  }
  return byParent
}

/**
 * Left-rail sidebar with three sections:
 *  - All / Uncategorized shortcut
 *  - Folder list (CRUD inline if canUpdate)
 *  - Popular tags (top 20)
 *
 * Selecting a folder/tag updates parent via callbacks. The currently selected
 * pill is highlighted. The whole component fetches its own data on mount.
 */
/**
 * Folders are owned by the parent screen (single source of truth for the count
 * badges and bulk-move popover). We accept them as a prop and signal mutations
 * back via {@code onFoldersChanged} so the parent can refetch.
 */
export function MediaFolderSidebar({
  folderFilter,
  tag,
  canUpdate,
  folders = [],
  onFoldersChanged,
  onSelectFolder,
  onSelectTag,
}) {
  const { t } = useTranslation()
  const [tags, setTags] = useState([])
  const [tagsStatus, setTagsStatus] = useState('loading') // 'loading' | 'error' | 'ready'
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Tạo/đổi tên/xoá thư mục là việc thỉnh thoảng mới làm — ẩn sau công tắc "Quản lý"
  // để trạng thái nghỉ của sidebar chỉ còn danh sách để lọc, không có nút nào.
  const [manageMode, setManageMode] = useState(false)
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const rootIds = folders
      .filter((folder) => !folder.parentId)
      .filter((folder) => folders.some((candidate) => candidate.parentId === folder.id))
      .map((folder) => folder.id)
    setExpandedIds((current) => {
      const next = new Set([...current, ...rootIds])
      for (const id of current) {
        if (!folders.some((folder) => folder.id === id)) next.delete(id)
      }
      return next
    })
  }, [folders])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Tags are local — they don't drive bulk actions, so the sidebar can own them.
  // Trạng thái tải/lỗi hiển thị rõ ngay trong khu vực tag thay vì chỉ toast rồi im.
  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTagsStatus('loading')
    fetchMediaTags()
      .then((ts) => {
        if (active) {
          setTags(ts)
          setTagsStatus('ready')
        }
      })
      .catch(() => {
        if (active) setTagsStatus('error')
      })
    return () => {
      active = false
    }
  }, [])

  async function handleCreate(name) {
    if (!name?.trim()) return
    try {
      await createMediaFolder({ name: name.trim() })
      toast.success(t('media.folderCreated'))
      setCreating(false)
      onFoldersChanged?.()
    } catch (e) {
      toast.error(e.message || t('common.error'))
    }
  }

  async function handleRename(id, name, folder) {
    if (!name?.trim()) return
    try {
      await updateMediaFolder(id, { name: name.trim(), parentId: folder?.parentId ?? null })
      toast.success(t('media.folderUpdated'))
      setEditingId(null)
      onFoldersChanged?.()
    } catch (e) {
      toast.error(e.message || t('common.error'))
    }
  }

  function toggleExpanded(folderId) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  async function handleDelete(folder) {
    const confirmed = await showConfirm(
      t('media.folderDeleteConfirm', { name: folder.name }),
      t('common.permanentDeleteTitle'),
      { variant: 'danger', confirmLabel: t('common.permanentDelete') },
    )
    if (!confirmed) return
    try {
      await deleteMediaFolder(folder.id)
      toast.success(t('media.folderDeleted'))
      if (folderFilter === folder.id) onSelectFolder('')
      onFoldersChanged?.()
    } catch (e) {
      toast.error(e.message || t('common.error'))
    }
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 self-start rounded-[var(--admin-radius-card)] border border-border bg-surface p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-var(--admin-space-8))] lg:w-56 lg:overflow-y-auto">
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-between lg:hidden"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className="inline-flex items-center gap-2">
          <FolderOpen size={16} aria-hidden="true" />
          {t('media.folders')}
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', mobileOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </Button>

      <div className={cn('flex flex-col gap-4', !mobileOpen && 'max-lg:hidden')}>
        <section className="flex flex-col gap-2">
          <p className="m-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t('media.folders')}
          </p>
          <ul
            className="m-0 flex list-none flex-col gap-1 p-0"
            role="tree"
            aria-label={t('media.folders')}
          >
            <li>
              <Button
                variant="ghost"
                onClick={() => {
                  onSelectFolder('')
                  setMobileOpen(false)
                }}
                aria-current={!folderFilter ? 'true' : undefined}
                className={cn(
                  'w-full justify-start px-3 text-sm',
                  !folderFilter && 'bg-surface-selected text-primary',
                )}
              >
                <FolderOpen size={14} />
                <span>{t('media.allFolders')}</span>
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                onClick={() => {
                  onSelectFolder('NONE')
                  setMobileOpen(false)
                }}
                aria-current={folderFilter === 'NONE' ? 'true' : undefined}
                className={cn(
                  'w-full justify-start px-3 text-sm',
                  folderFilter === 'NONE' && 'bg-surface-selected text-primary',
                )}
              >
                <Inbox size={14} />
                <span>{t('media.uncategorized')}</span>
              </Button>
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t('media.myFolders')}
            </p>
            {canUpdate && (
              <div className="flex items-center gap-1">
                {manageMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreating(true)}
                    className="w-7 px-0"
                    aria-label={t('media.folderAdd')}
                    title={t('media.folderAdd')}
                  >
                    <Plus size={14} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={manageMode}
                  onClick={() => {
                    setManageMode((s) => !s)
                    setCreating(false)
                    setEditingId(null)
                  }}
                  className="w-auto px-2 text-xs"
                >
                  {manageMode ? t('media.folderManageDone') : t('media.folderManage')}
                </Button>
              </div>
            )}
          </div>
          {folders.length === 0 && !creating && (
            <p className="my-1 text-xs text-muted-foreground">{t('media.foldersEmpty')}</p>
          )}
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {creating && (
              <li>
                <FolderInput
                  onSubmit={handleCreate}
                  onCancel={() => setCreating(false)}
                  placeholder={t('media.folderNamePlaceholder')}
                />
              </li>
            )}
            <FolderTree
              foldersByParent={buildFolderTree(folders)}
              parentId={null}
              expandedIds={expandedIds}
              folderFilter={folderFilter}
              canUpdate={canUpdate}
              manageMode={manageMode}
              editingId={editingId}
              onToggleExpanded={toggleExpanded}
              onSelectFolder={(id) => {
                onSelectFolder(id)
                setMobileOpen(false)
              }}
              onStartEditing={setEditingId}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          </ul>
        </section>

        {(tagsStatus !== 'ready' || tags.length > 0) && (
          <section className="flex flex-col gap-2">
            <p className="m-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t('media.popularTags')}
            </p>
            {tagsStatus === 'loading' && (
              <p className="my-1 text-xs text-muted-foreground" role="status">
                {t('common.loading')}
              </p>
            )}
            {tagsStatus === 'error' && (
              <p className="my-1 text-xs text-muted-foreground">
                {t('media.tagsError', { defaultValue: 'Không tải được thẻ' })}
              </p>
            )}
            {tagsStatus === 'ready' && tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tg) => (
                  <Button
                    variant={tag === tg ? 'default' : 'outline'}
                    size="sm"
                    key={tg}
                    onClick={() => {
                      onSelectTag(tag === tg ? '' : tg)
                      setMobileOpen(false)
                    }}
                    aria-pressed={tag === tg}
                    className="h-7 px-2 text-xs"
                  >
                    <Hash size={11} /> {tg}
                  </Button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  )
}

function FolderTree({
  foldersByParent,
  parentId,
  expandedIds,
  folderFilter,
  canUpdate,
  manageMode,
  editingId,
  onToggleExpanded,
  onSelectFolder,
  onStartEditing,
  onDelete,
  onRename,
}) {
  const { t } = useTranslation()
  const folders = foldersByParent.get(parentId) || []
  return folders.map((folder) => {
    const children = foldersByParent.get(folder.id) || []
    const hasChildren = children.length > 0
    const expanded = expandedIds.has(folder.id)
    const protectedFolder = Boolean(folder.systemKey)
    return (
      <li
        key={folder.id}
        role="treeitem"
        aria-level={folder.depth + 1}
        aria-expanded={hasChildren ? expanded : undefined}
      >
        {editingId === folder.id ? (
          <FolderInput
            defaultValue={folder.name}
            onSubmit={(name) => onRename(folder.id, name, folder)}
            onCancel={() => onStartEditing(null)}
          />
        ) : (
          <div
            className={cn(
              'relative flex items-center rounded-[var(--admin-radius-control)]',
              folderFilter === folder.id && 'bg-surface-selected text-primary',
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-1 h-8 w-7 shrink-0"
              onClick={() => hasChildren && onToggleExpanded(folder.id)}
              disabled={!hasChildren}
              aria-label={
                hasChildren
                  ? expanded
                    ? t('media.collapseFolder')
                    : t('media.expandFolder')
                  : t('media.folderNoChildren')
              }
              aria-expanded={hasChildren ? expanded : undefined}
            >
              {hasChildren ? (
                expanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )
              ) : (
                <span className="size-3" aria-hidden="true" />
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onSelectFolder(folder.id)}
              aria-current={folderFilter === folder.id ? 'true' : undefined}
              className={cn(
                'min-w-0 flex-1 justify-start px-2 text-sm',
                folder.depth > 0 && 'pl-1',
              )}
            >
              {expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
              <span className="min-w-0 flex-1 truncate text-left">
                {getMediaFolderLabel(folder, t)}
              </span>
              <span
                className={cn(
                  'rounded-full bg-surface-muted px-2 text-xs text-muted-foreground',
                  folderFilter === folder.id && 'bg-primary text-primary-foreground',
                )}
              >
                {folder.mediaCount}
              </span>
            </Button>
            {canUpdate && manageMode && !protectedFolder && (
              <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-1 bg-surface p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onStartEditing(folder.id)}
                  className="w-7 px-0"
                  aria-label={t('common.edit')}
                  title={t('common.edit')}
                >
                  <Pencil size={11} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(folder)}
                  className="w-7 px-0 text-danger"
                  aria-label={t('common.delete')}
                  title={t('common.delete')}
                >
                  <Trash2 size={11} />
                </Button>
              </div>
            )}
          </div>
        )}
        {hasChildren && expanded ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 pl-4" role="group">
            <FolderTree
              foldersByParent={foldersByParent}
              parentId={folder.id}
              expandedIds={expandedIds}
              folderFilter={folderFilter}
              canUpdate={canUpdate}
              manageMode={manageMode}
              editingId={editingId}
              onToggleExpanded={onToggleExpanded}
              onSelectFolder={onSelectFolder}
              onStartEditing={onStartEditing}
              onDelete={onDelete}
              onRename={onRename}
            />
          </ul>
        ) : null}
      </li>
    )
  })
}

function FolderInput({ defaultValue = '', placeholder, onSubmit, onCancel }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(defaultValue)
  // Rename không có placeholder → vẫn cần accessible name cho ô nhập.
  const accessibleLabel = placeholder || t('media.folderNamePlaceholder')
  // Explicit Lưu/Huỷ so a rename isn't lost by clicking away, and doesn't require
  // discovering that Enter saves. Escape still cancels for keyboard users.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value)
      }}
      className="py-1"
    >
      <Input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        aria-label={accessibleLabel}
        className="text-xs py-1 px-2"
      />
      <div className="flex items-center gap-2 mt-2">
        <Button type="submit" size="sm" disabled={!value.trim()}>
          {t('common.save')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}
