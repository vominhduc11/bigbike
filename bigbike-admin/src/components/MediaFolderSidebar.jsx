import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Folder, FolderOpen, Plus, Pencil, Trash2, Inbox, Hash } from 'lucide-react'
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

  async function handleRename(id, name) {
    if (!name?.trim()) return
    try {
      await updateMediaFolder(id, { name: name.trim() })
      toast.success(t('media.folderUpdated'))
      setEditingId(null)
      onFoldersChanged?.()
    } catch (e) {
      toast.error(e.message || t('common.error'))
    }
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
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
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
            {folders.map((f) => (
              <li key={f.id}>
                {editingId === f.id ? (
                  <FolderInput
                    defaultValue={f.name}
                    onSubmit={(name) => handleRename(f.id, name)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    className={cn(
                      'relative flex items-center rounded-[var(--admin-radius-control)]',
                      folderFilter === f.id && 'bg-surface-selected text-primary',
                    )}
                  >
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onSelectFolder(f.id)
                        setMobileOpen(false)
                      }}
                      aria-current={folderFilter === f.id ? 'true' : undefined}
                      className="w-full justify-start px-3 text-sm"
                    >
                      <Folder size={14} />
                      <span className="min-w-0 flex-1 truncate text-left">{f.name}</span>
                      <span
                        className={cn(
                          'rounded-full bg-surface-muted px-2 text-xs text-muted-foreground',
                          folderFilter === f.id && 'bg-primary text-primary-foreground',
                        )}
                      >
                        {f.mediaCount}
                      </span>
                    </Button>
                    {canUpdate && manageMode && (
                      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-1 bg-surface p-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(f.id)}
                          className="w-7 px-0"
                          aria-label={t('common.edit')}
                          title={t('common.edit')}
                        >
                          <Pencil size={11} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(f)}
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
              </li>
            ))}
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
