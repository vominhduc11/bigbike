import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, FolderOpen, Plus, Pencil, Trash2, Inbox, Hash } from 'lucide-react'
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
    <aside className="mediafolder-sidebar">
      <section className="mediafolder-section">
        <p className="mediafolder-section-title">{t('media.folders')}</p>
        <ul className="mediafolder-list">
          <li>
            <Button
              variant="unstyled"
              onClick={() => onSelectFolder('')}
              aria-current={!folderFilter ? 'true' : undefined}
              className={`mediafolder-item ${!folderFilter ? 'mediafolder-is-selected' : ''}`}
            >
              <FolderOpen size={14} />
              <span>{t('media.allFolders')}</span>
            </Button>
          </li>
          <li>
            <Button
              variant="unstyled"
              onClick={() => onSelectFolder('NONE')}
              aria-current={folderFilter === 'NONE' ? 'true' : undefined}
              className={`mediafolder-item ${folderFilter === 'NONE' ? 'mediafolder-is-selected' : ''}`}
            >
              <Inbox size={14} />
              <span>{t('media.uncategorized')}</span>
            </Button>
          </li>
        </ul>
      </section>

      <section className="mediafolder-section">
        <div className="mediafolder-section-header">
          <p className="mediafolder-section-title">{t('media.myFolders')}</p>
          {canUpdate && (
            <div className="flex items-center gap-1">
              {manageMode && (
                <Button
                  variant="unstyled"
                  onClick={() => setCreating(true)}
                  className="mediafolder-add-btn"
                  aria-label={t('media.folderAdd')}
                  title={t('media.folderAdd')}
                >
                  <Plus size={14} />
                </Button>
              )}
              <Button
                variant="unstyled"
                aria-pressed={manageMode}
                onClick={() => {
                  setManageMode((s) => !s)
                  setCreating(false)
                  setEditingId(null)
                }}
                className="mediafolder-action-btn w-auto px-1.5 text-xs"
              >
                {manageMode ? t('media.folderManageDone') : t('media.folderManage')}
              </Button>
            </div>
          )}
        </div>
        {folders.length === 0 && !creating && (
          <p className="mediafolder-empty">{t('media.foldersEmpty')}</p>
        )}
        <ul className="mediafolder-list">
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
                  className={`mediafolder-item ${folderFilter === f.id ? 'mediafolder-is-selected' : ''} mediafolder-item-hover`}
                >
                  <Button
                    variant="unstyled"
                    onClick={() => onSelectFolder(f.id)}
                    aria-current={folderFilter === f.id ? 'true' : undefined}
                    className="mediafolder-item-btn"
                  >
                    <Folder size={14} />
                    <span className="mediafolder-item-label">{f.name}</span>
                    <span className="mediafolder-item-count">{f.mediaCount}</span>
                  </Button>
                  {canUpdate && manageMode && (
                    <div className="mediafolder-item-actions">
                      <Button
                        variant="unstyled"
                        onClick={() => setEditingId(f.id)}
                        className="mediafolder-action-btn"
                        aria-label={t('common.edit')}
                        title={t('common.edit')}
                      >
                        <Pencil size={11} />
                      </Button>
                      <Button
                        variant="unstyled"
                        onClick={() => handleDelete(f)}
                        className="mediafolder-action-btn"
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
        <section className="mediafolder-section">
          <p className="mediafolder-section-title">{t('media.popularTags')}</p>
          {tagsStatus === 'loading' && (
            <p className="mediafolder-empty" role="status">
              {t('common.loading')}
            </p>
          )}
          {tagsStatus === 'error' && (
            <p className="mediafolder-empty">
              {t('media.tagsError', { defaultValue: 'Không tải được thẻ' })}
            </p>
          )}
          {tagsStatus === 'ready' && tags.length > 0 && (
            <div className="mediafolder-tags-wrap">
              {tags.map((tg) => (
                <Button
                  variant="unstyled"
                  key={tg}
                  onClick={() => onSelectTag(tag === tg ? '' : tg)}
                  aria-pressed={tag === tg}
                  className={`mediafolder-tag ${tag === tg ? 'mediafolder-tag-selected' : ''}`}
                >
                  <Hash size={11} /> {tg}
                </Button>
              ))}
            </div>
          )}
        </section>
      )}
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
      className="mediafolder-edit-form"
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
      <div className="flex items-center gap-1.5 mt-1.5">
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
