import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, FolderOpen, Plus, Edit2, Trash2, Inbox, Hash } from 'lucide-react'
import { toast } from 'sonner'
import { showConfirm } from '../lib/confirm'
import {
  createMediaFolder,
  deleteMediaFolder,
  fetchMediaTags,
  updateMediaFolder,
} from '../lib/adminApi'
import { Input } from '@/components/ui/input'

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
  folderFilter, tag, canUpdate,
  folders = [],
  onFoldersChanged,
  onSelectFolder, onSelectTag,
}) {
  const { t } = useTranslation()
  const [tags, setTags] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)

  // Tags are local — they don't drive bulk actions, so the sidebar can own them.
  useEffect(() => {
    let active = true
    fetchMediaTags()
      .then((ts) => { if (active) setTags(ts) })
      .catch((e) => { if (active) toast.error(e.message || t('common.error')) })
    return () => { active = false }
  }, [t])

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
      t('media.folderDeleteConfirmTitle'))
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
            <button type="button" onClick={() => onSelectFolder('')}
              className={`mediafolder-item ${!folderFilter ? 'mediafolder-is-selected' : ''}`}>
              <FolderOpen size={14} />
              <span>{t('media.allFolders')}</span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => onSelectFolder('NONE')}
              className={`mediafolder-item ${folderFilter === 'NONE' ? 'mediafolder-is-selected' : ''}`}>
              <Inbox size={14} />
              <span>{t('media.uncategorized')}</span>
            </button>
          </li>
        </ul>
      </section>

      <section className="mediafolder-section">
        <div className="mediafolder-section-header">
          <p className="mediafolder-section-title">{t('media.myFolders')}</p>
          {canUpdate && (
            <button type="button" onClick={() => setCreating(true)} className="mediafolder-add-btn"
              aria-label={t('media.folderAdd')} title={t('media.folderAdd')}>
              <Plus size={14} />
            </button>
          )}
        </div>
        {folders.length === 0 && !creating && (
          <p className="mediafolder-empty">{t('media.foldersEmpty')}</p>
        )}
        <ul className="mediafolder-list">
          {creating && (
            <li>
              <FolderInput onSubmit={handleCreate} onCancel={() => setCreating(false)}
                placeholder={t('media.folderNamePlaceholder')} />
            </li>
          )}
          {folders.map((f) => (
            <li key={f.id}>
              {editingId === f.id ? (
                <FolderInput defaultValue={f.name}
                  onSubmit={(name) => handleRename(f.id, name)}
                  onCancel={() => setEditingId(null)} />
              ) : (
                <div className={`mediafolder-item ${folderFilter === f.id ? 'mediafolder-is-selected' : ''} mediafolder-item-hover`}>
                  <button type="button" onClick={() => onSelectFolder(f.id)}
                    className="mediafolder-item-btn">
                    <Folder size={14} />
                    <span className="mediafolder-item-label">{f.name}</span>
                    <span className="mediafolder-item-count">{f.mediaCount}</span>
                  </button>
                  {canUpdate && (
                    <div className="mediafolder-item-actions">
                      <button type="button" onClick={() => setEditingId(f.id)}
                        className="mediafolder-action-btn" aria-label={t('common.edit')} title={t('common.edit')}>
                        <Edit2 size={11} />
                      </button>
                      <button type="button" onClick={() => handleDelete(f)}
                        className="mediafolder-action-btn" aria-label={t('common.delete')} title={t('common.delete')}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {tags.length > 0 && (
        <section className="mediafolder-section">
          <p className="mediafolder-section-title">{t('media.popularTags')}</p>
          <div className="mediafolder-tags-wrap">
            {tags.map((tg) => (
              <button key={tg} type="button"
                onClick={() => onSelectTag(tag === tg ? '' : tg)}
                className={`mediafolder-tag ${tag === tg ? 'mediafolder-tag-selected' : ''}`}>
                <Hash size={11} /> {tg}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}

function FolderInput({ defaultValue = '', placeholder, onSubmit, onCancel }) {
  const [value, setValue] = useState(defaultValue)
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(value) }}
      className="mediafolder-edit-form">
      <Input autoFocus type="text" value={value} onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (!value.trim()) onCancel() }}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }} placeholder={placeholder}
        className="text-xs py-1 px-2"  />
    </form>
  )
}
