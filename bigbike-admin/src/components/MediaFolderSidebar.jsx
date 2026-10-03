import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Hash,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Waypoints,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { showConfirm } from '../lib/confirm'
import {
  createMediaFolder,
  deleteMediaFolder,
  fetchMediaTags,
  updateMediaFolder,
} from '../lib/adminApi'
import { Modal } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getMediaFolderLabel, getSystemFolderDeleteWarning } from '@/lib/mediaFolderUtils'

const ROOT_FOLDER_VALUE = '__ROOT__'

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

function folderActionError(t, error, childCount = 0) {
  if (error?.code === 'MEDIA_FOLDER_NAME_DUPLICATE') return t('media.folderNameDuplicate')
  if (error?.code === 'MEDIA_FOLDER_HAS_CHILDREN')
    return t('media.folderHasChildren', { count: childCount })
  if (error?.code === 'MEDIA_FOLDER_INVALID_PARENT') return t('media.folderInvalidParent')
  if (error?.code === 'MEDIA_FOLDER_DEPTH_LIMIT') return t('media.folderDepthLimit')
  if (error?.status === 403) return t('media.actionForbidden')
  if (error?.status === 404) return t('media.folderNotFound')
  if (error?.status === 0 || error?.code === 'NETWORK_ERROR') return t('media.actionNetworkError')
  if (error?.code === 'VALIDATION_ERROR') return t('media.folderNameRequired')
  return t('common.error')
}

function folderPayload(folder, overrides = {}) {
  return {
    name: folder.name,
    slug: folder.slug,
    description: folder.description ?? null,
    parentId: folder.parentId ?? null,
    ...overrides,
  }
}

/** Folder navigation and management for the Media Library. */
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
  const [tagsStatus, setTagsStatus] = useState('loading')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [nameDialog, setNameDialog] = useState(null)
  const [moveFolder, setMoveFolder] = useState(null)
  const [systemDeleteFolder, setSystemDeleteFolder] = useState(null)
  const mobileToggleRef = useRef(null)
  const contentId = useId()

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

  useEffect(() => {
    let active = true
    fetchMediaTags()
      .then((result) => {
        if (active) {
          setTags(result)
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

  function closeMobileNavigation() {
    if (!mobileOpen) return
    setMobileOpen(false)
    mobileToggleRef.current?.focus()
  }

  function toggleExpanded(folderId) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  async function saveFolderName(name) {
    const trimmedName = name.trim()
    if (!trimmedName) return t('media.folderNameRequired')
    const dialog = nameDialog
    try {
      if (dialog?.mode === 'create') {
        await createMediaFolder({ name: trimmedName, parentId: dialog.parentId ?? null })
        toast.success(t('media.folderCreated'))
      } else if (dialog?.folder) {
        await updateMediaFolder(
          dialog.folder.id,
          folderPayload(dialog.folder, { name: trimmedName }),
        )
        toast.success(t('media.folderUpdated'))
      }
      setNameDialog(null)
      onFoldersChanged?.()
      return ''
    } catch (error) {
      return folderActionError(t, error, childCountFor(dialog?.folder, folders))
    }
  }

  async function moveFolderTo(parentId) {
    if (!moveFolder) return ''
    const childCount = childCountFor(moveFolder, folders)
    if (childCount > 0) return t('media.folderMoveHasChildren', { count: childCount })
    try {
      await updateMediaFolder(moveFolder.id, folderPayload(moveFolder, { parentId }))
      toast.success(t('media.folderMoved'))
      setMoveFolder(null)
      onFoldersChanged?.()
      return ''
    } catch (error) {
      return folderActionError(t, error, childCount)
    }
  }

  async function deleteFolder(folder) {
    try {
      await deleteMediaFolder(folder.id)
      toast.success(t('media.folderDeleted'))
      if (folderFilter === folder.id) onSelectFolder('')
      setSystemDeleteFolder(null)
      onFoldersChanged?.()
    } catch (error) {
      toast.error(folderActionError(t, error, childCountFor(folder, folders)))
    }
  }

  async function requestDelete(folder) {
    const childCount = childCountFor(folder, folders)
    if (childCount > 0) {
      toast.error(t('media.folderHasChildren', { count: childCount }))
      return
    }
    if (folder.systemKey) {
      setSystemDeleteFolder(folder)
      return
    }
    const name = getMediaFolderLabel(folder, t)
    const confirmed = await showConfirm(
      t('media.folderDeleteConfirm', { name }),
      t('media.folderDeleteConfirmTitle'),
      { variant: 'danger', confirmLabel: t('common.permanentDelete') },
    )
    if (confirmed) await deleteFolder(folder)
  }

  return (
    <aside
      aria-label={t('media.folders')}
      className="flex min-w-0 w-full flex-col gap-4 self-start rounded-[var(--admin-radius-card)] border border-border bg-surface p-3 lg:sticky lg:top-[calc(var(--bb-topbar-h)+var(--admin-space-4))] lg:max-h-[calc(100dvh-var(--bb-topbar-h)-var(--admin-space-8))] lg:overflow-y-auto"
    >
      <Button
        ref={mobileToggleRef}
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-between lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls={contentId}
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

      <div id={contentId} className={cn('flex flex-col gap-4', !mobileOpen && 'max-lg:hidden')}>
        <section className="flex flex-col gap-2">
          <p className="m-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t('media.folders')}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label={t('media.folders')}>
            <li>
              <Button
                variant="ghost"
                onClick={() => {
                  onSelectFolder('')
                  closeMobileNavigation()
                }}
                aria-current={!folderFilter ? 'true' : undefined}
                className={cn(
                  'h-auto min-h-12 w-full justify-start whitespace-normal px-3 py-2 text-sm',
                  !folderFilter && 'bg-surface-selected text-primary',
                )}
              >
                <FolderOpen size={16} className="shrink-0" aria-hidden="true" />
                <span>{t('media.allFolders')}</span>
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                onClick={() => {
                  onSelectFolder('NONE')
                  closeMobileNavigation()
                }}
                aria-current={folderFilter === 'NONE' ? 'true' : undefined}
                className={cn(
                  'h-auto min-h-12 w-full justify-start whitespace-normal px-3 py-2 text-sm',
                  folderFilter === 'NONE' && 'bg-surface-selected text-primary',
                )}
              >
                <Inbox size={16} className="shrink-0" aria-hidden="true" />
                <span>{t('media.uncategorized')}</span>
              </Button>
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex flex-col items-start gap-2">
            <p className="m-0 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t('media.myFolders')}
            </p>
            {canUpdate ? (
              <Button
                variant="outline"
                size="sm"
                className="min-h-9 shrink-0 max-lg:min-h-11"
                onClick={() => setNameDialog({ mode: 'create', parentId: null })}
              >
                <Plus size={14} aria-hidden="true" />
                {t('media.folderAdd')}
              </Button>
            ) : null}
          </div>
          {folders.length === 0 ? (
            <p className="my-1 text-xs text-muted-foreground">{t('media.foldersEmpty')}</p>
          ) : null}
          <TooltipProvider delayDuration={250}>
            <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label={t('media.myFolders')}>
              <FolderTree
                foldersByParent={buildFolderTree(folders)}
                parentId={null}
                expandedIds={expandedIds}
                folderFilter={folderFilter}
                canUpdate={canUpdate}
                onToggleExpanded={toggleExpanded}
                onSelectFolder={(id) => {
                  onSelectFolder(id)
                  closeMobileNavigation()
                }}
                onRename={(folder) => setNameDialog({ mode: 'rename', folder })}
                onCreateChild={(folder) =>
                  setNameDialog({ mode: 'create', parentId: folder.id, parent: folder })
                }
                onMove={setMoveFolder}
                onDelete={requestDelete}
              />
            </ul>
          </TooltipProvider>
        </section>

        {tagsStatus !== 'ready' || tags.length > 0 ? (
          <section className="flex flex-col gap-2">
            <p className="m-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t('media.popularTags')}
            </p>
            {tagsStatus === 'loading' ? (
              <p className="my-1 text-xs text-muted-foreground" role="status">
                {t('common.loading')}
              </p>
            ) : null}
            {tagsStatus === 'error' ? (
              <p className="my-1 text-xs text-muted-foreground">{t('media.tagsError')}</p>
            ) : null}
            {tagsStatus === 'ready' && tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {tags.map((tagValue) => (
                  <Button
                    variant={tag === tagValue ? 'default' : 'outline'}
                    size="sm"
                    key={tagValue}
                    onClick={() => {
                      onSelectTag(tag === tagValue ? '' : tagValue)
                      closeMobileNavigation()
                    }}
                    aria-pressed={tag === tagValue}
                    className="h-auto min-h-7 px-2 text-xs max-lg:min-h-11 max-lg:min-w-11"
                  >
                    <Hash size={11} aria-hidden="true" /> {tagValue}
                  </Button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <FolderNameDialog
        key={
          nameDialog
            ? `${nameDialog.mode}-${nameDialog.folder?.id ?? nameDialog.parentId ?? 'root'}`
            : 'name-closed'
        }
        dialog={nameDialog}
        onClose={() => setNameDialog(null)}
        onSave={saveFolderName}
      />
      <FolderMoveDialog
        key={moveFolder ? `move-${moveFolder.id}` : 'move-closed'}
        folder={moveFolder}
        folders={folders}
        onClose={() => setMoveFolder(null)}
        onMove={moveFolderTo}
      />
      <SystemFolderDeleteDialog
        folder={systemDeleteFolder}
        onClose={() => setSystemDeleteFolder(null)}
        onDelete={deleteFolder}
      />
    </aside>
  )
}

function FolderTree({
  foldersByParent,
  parentId,
  expandedIds,
  folderFilter,
  canUpdate,
  onToggleExpanded,
  onSelectFolder,
  onRename,
  onCreateChild,
  onMove,
  onDelete,
}) {
  const { t } = useTranslation()
  const labelRefs = useRef(new Map())
  const [tooltipFolderId, setTooltipFolderId] = useState(null)
  const folders = foldersByParent.get(parentId) || []
  return folders.map((folder) => {
    const children = foldersByParent.get(folder.id) || []
    const hasChildren = children.length > 0
    const expanded = expandedIds.has(folder.id)
    const selected = folderFilter === folder.id
    const label = getMediaFolderLabel(folder, t)
    return (
      <li key={folder.id}>
        <div
          className={cn(
            'flex items-center rounded-[var(--admin-radius-control)]',
            selected && 'bg-surface-selected text-primary',
          )}
        >
          {hasChildren ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'shrink-0 text-muted-foreground max-lg:h-11 max-lg:w-11',
                selected && 'text-primary',
              )}
              onClick={() => onToggleExpanded(folder.id)}
              aria-label={`${t(expanded ? 'media.collapseFolder' : 'media.expandFolder')}: ${label}`}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown size={16} aria-hidden="true" />
              ) : (
                <ChevronRight size={16} aria-hidden="true" />
              )}
            </Button>
          ) : (
            <span className="w-9 shrink-0 max-lg:w-11" aria-hidden="true" />
          )}
          <Tooltip
            open={tooltipFolderId === folder.id}
            onOpenChange={(open) => {
              const element = labelRefs.current.get(folder.id)
              const clipped =
                element &&
                (element.scrollHeight > element.clientHeight ||
                  element.scrollWidth > element.clientWidth)
              setTooltipFolderId((current) =>
                open ? (clipped ? folder.id : null) : current === folder.id ? null : current,
              )
            }}
          >
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => onSelectFolder(folder.id)}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'h-auto min-h-12 min-w-0 flex-1 self-stretch justify-start whitespace-normal px-1 py-2 text-sm font-medium',
                  selected && 'font-semibold text-primary',
                )}
              >
                {expanded ? (
                  <FolderOpen size={16} className="shrink-0" aria-hidden="true" />
                ) : (
                  <Folder size={16} className="shrink-0" aria-hidden="true" />
                )}
                <span
                  ref={(element) => {
                    if (element) labelRefs.current.set(folder.id, element)
                    else labelRefs.current.delete(folder.id)
                  }}
                  className="line-clamp-2 min-w-0 flex-1 wrap-anywhere text-left leading-5"
                >
                  {label}
                </span>
                <span
                  className={cn(
                    'min-w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground',
                    selected && 'text-primary',
                  )}
                >
                  {folder.mediaCount}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-80 whitespace-normal wrap-anywhere leading-relaxed">
              {label}
            </TooltipContent>
          </Tooltip>
          {canUpdate ? (
            <FolderActions
              folder={folder}
              onRename={onRename}
              onCreateChild={onCreateChild}
              onMove={onMove}
              onDelete={onDelete}
            />
          ) : null}
        </div>
        {hasChildren && expanded ? (
          <ul className="my-1 mr-0 ml-4 flex list-none flex-col gap-1 border-l border-border p-0">
            <FolderTree
              foldersByParent={foldersByParent}
              parentId={folder.id}
              expandedIds={expandedIds}
              folderFilter={folderFilter}
              canUpdate={canUpdate}
              onToggleExpanded={onToggleExpanded}
              onSelectFolder={onSelectFolder}
              onRename={onRename}
              onCreateChild={onCreateChild}
              onMove={onMove}
              onDelete={onDelete}
            />
          </ul>
        ) : null}
      </li>
    )
  })
}

function FolderActions({ folder, onRename, onCreateChild, onMove, onDelete }) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground max-lg:h-11 max-lg:w-11"
          aria-label={t('media.folderActions', { name: getMediaFolderLabel(folder, t) })}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-var(--admin-space-8))]">
        <DropdownMenuLabel className="whitespace-normal wrap-anywhere text-sm">
          {getMediaFolderLabel(folder, t)}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="max-lg:min-h-11" onSelect={() => onRename(folder)}>
          <Pencil aria-hidden="true" />
          {t('common.edit')}
        </DropdownMenuItem>
        {!folder.parentId ? (
          <DropdownMenuItem className="max-lg:min-h-11" onSelect={() => onCreateChild(folder)}>
            <Plus aria-hidden="true" />
            {t('media.folderAddChild')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem className="max-lg:min-h-11" onSelect={() => onMove(folder)}>
          <Waypoints aria-hidden="true" />
          {t('media.folderMove')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger focus:text-danger max-lg:min-h-11"
          onSelect={() => onDelete(folder)}
        >
          <Trash2 aria-hidden="true" />
          {t('common.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FolderNameDialog({ dialog, onClose, onSave }) {
  const { t } = useTranslation()
  const [name, setName] = useState(() => dialog?.folder?.name ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isCreate = dialog?.mode === 'create'
  const parent = dialog?.parent

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setError(t('media.folderNameRequired'))
      return
    }
    setSaving(true)
    const saveError = await onSave(name)
    setSaving(false)
    if (saveError) setError(saveError)
  }

  const formId = isCreate ? 'media-folder-create-form' : 'media-folder-rename-form'
  return (
    <Modal
      open={Boolean(dialog)}
      onClose={saving ? () => {} : onClose}
      title={
        isCreate
          ? parent
            ? t('media.folderAddChildTitle')
            : t('media.folderAddTitle')
          : t('media.folderRenameTitle')
      }
      description={
        parent
          ? t('media.folderAddChildDescription', { name: getMediaFolderLabel(parent, t) })
          : undefined
      }
      actions={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={!name.trim()}>
            {isCreate ? t('common.add') : t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor={`${formId}-name`} className="text-sm font-medium text-foreground">
          {t('media.folderName')}
        </label>
        <Input
          id={`${formId}-name`}
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('media.folderNamePlaceholder')}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${formId}-error` : undefined}
        />
        {error ? (
          <p id={`${formId}-error`} className="m-0 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

function FolderMoveDialog({ folder, folders, onClose, onMove }) {
  const { t } = useTranslation()
  const [parentId, setParentId] = useState(() => folder?.parentId ?? ROOT_FOLDER_VALUE)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const childCount = childCountFor(folder, folders)
  const rootFolders = folders.filter(
    (candidate) => !candidate.parentId && candidate.id !== folder?.id,
  )

  async function handleSubmit(event) {
    event.preventDefault()
    if (childCount > 0) {
      setError(t('media.folderMoveHasChildren', { count: childCount }))
      return
    }
    setSaving(true)
    const moveError = await onMove(parentId === ROOT_FOLDER_VALUE ? null : parentId)
    setSaving(false)
    if (moveError) setError(moveError)
  }

  return (
    <Modal
      open={Boolean(folder)}
      onClose={saving ? () => {} : onClose}
      title={t('media.folderMoveTitle', { name: getMediaFolderLabel(folder, t) })}
      actions={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="media-folder-move-form"
            loading={saving}
            disabled={childCount > 0}
          >
            {t('media.folderMoveConfirm')}
          </Button>
        </>
      }
    >
      <form id="media-folder-move-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        {childCount > 0 ? (
          <div
            className="flex gap-2 rounded-[var(--admin-radius-control)] border border-danger/40 bg-danger/10 p-3 text-sm text-foreground"
            role="alert"
          >
            <AlertTriangle className="mt-1 size-4 shrink-0 text-danger" aria-hidden="true" />
            <span>{t('media.folderMoveHasChildren', { count: childCount })}</span>
          </div>
        ) : (
          <>
            <label htmlFor="media-folder-parent" className="text-sm font-medium text-foreground">
              {t('media.folderParent')}
            </label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger id="media-folder-parent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT_FOLDER_VALUE}>{t('media.folderMoveToRoot')}</SelectItem>
                {rootFolders.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {getMediaFolderLabel(candidate, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {error ? (
          <p className="m-0 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

function SystemFolderDeleteDialog({ folder, onClose, onDelete }) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!folder) return
    setDeleting(true)
    await onDelete(folder)
    setDeleting(false)
  }

  return (
    <Modal
      open={Boolean(folder)}
      onClose={deleting ? () => {} : onClose}
      title={t('media.systemFolderDeleteTitle', { name: getMediaFolderLabel(folder, t) })}
      actions={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="danger" onClick={confirmDelete} loading={deleting}>
            <Trash2 size={16} aria-hidden="true" />
            {t('media.systemFolderDeleteConfirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div
          className="flex gap-2 rounded-[var(--admin-radius-control)] border border-danger/40 bg-danger/10 p-3 text-sm text-foreground"
          role="alert"
        >
          <AlertTriangle className="mt-1 size-5 shrink-0 text-danger" aria-hidden="true" />
          <span>{getSystemFolderDeleteWarning(folder, t)}</span>
        </div>
        <p className="m-0 text-sm text-muted-foreground">
          {t('media.systemFolderDeleteMediaNote')}
        </p>
      </div>
    </Modal>
  )
}

function childCountFor(folder, folders) {
  if (!folder) return 0
  return folders.filter((candidate) => candidate.parentId === folder.id).length
}
