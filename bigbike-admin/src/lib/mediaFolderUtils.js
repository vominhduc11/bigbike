const SYSTEM_FOLDER_LABELS = {
  'root:products': 'media.folderTree.products',
  'root:articles': 'media.folderTree.articles',
  'root:brands': 'media.folderTree.brands',
  'root:categories': 'media.folderTree.categories',
  'root:banners': 'media.folderTree.banners',
  'root:illustrations': 'media.folderTree.illustrations',
  'root:videos': 'media.folderTree.videos',
  'products:unknown': 'media.folderTree.unknownBrand',
}

export function getMediaFolderLabel(folder, t) {
  if (!folder) return ''
  const key = SYSTEM_FOLDER_LABELS[folder.systemKey]
  return key && typeof t === 'function' ? t(key, { defaultValue: folder.name }) : folder.name
}

export function getMediaFolderPath(folderId, folders, t) {
  if (!folderId) return ''
  const byId = new Map((folders || []).map((folder) => [folder.id, folder]))
  const parts = []
  const seen = new Set()
  let current = byId.get(folderId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    parts.unshift(getMediaFolderLabel(current, t))
    current = current.parentId ? byId.get(current.parentId) : null
  }
  return parts.join(' › ')
}

export function getMediaFolderOptions(folders, t) {
  return (folders || []).map((folder) => ({
    value: folder.id,
    label: getMediaFolderPath(folder.id, folders, t) || getMediaFolderLabel(folder, t),
  }))
}
