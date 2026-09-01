const SYSTEM_FOLDER_LABELS = {
  'root:products': { key: 'media.folderTree.products', originalName: 'Sản phẩm' },
  'root:articles': { key: 'media.folderTree.articles', originalName: 'Bài viết' },
  'root:brands': { key: 'media.folderTree.brands', originalName: 'Thương hiệu' },
  'root:categories': { key: 'media.folderTree.categories', originalName: 'Danh mục' },
  'root:banners': { key: 'media.folderTree.banners', originalName: 'Banner' },
  'root:illustrations': { key: 'media.folderTree.illustrations', originalName: 'Ảnh minh hoạ' },
  'root:videos': { key: 'media.folderTree.videos', originalName: 'Video gốc' },
  'products:unknown': { key: 'media.folderTree.unknownBrand', originalName: 'Chưa rõ hãng' },
}

export function getMediaFolderLabel(folder, t) {
  if (!folder) return ''
  const systemLabel = SYSTEM_FOLDER_LABELS[folder.systemKey]
  // A saved name always wins. The built-in translated labels only support an
  // unchanged seeded name, so a rename stays visible after refresh and in EN.
  if (systemLabel && folder.name === systemLabel.originalName && typeof t === 'function') {
    return t(systemLabel.key, { defaultValue: folder.name })
  }
  return folder.name
}

export function getSystemFolderDeleteWarning(folder, t) {
  const name = getMediaFolderLabel(folder, t)
  const key = folder?.systemKey || ''
  if (key.startsWith('products:')) {
    return t('media.systemFolderDeleteImpact.productBrand', { name })
  }
  if (key.startsWith('articles:')) {
    return t('media.systemFolderDeleteImpact.articleYear', { name })
  }
  if (key === 'root:brands') return t('media.systemFolderDeleteImpact.brand')
  if (key === 'root:categories') return t('media.systemFolderDeleteImpact.category')
  if (key === 'root:banners') return t('media.systemFolderDeleteImpact.banner')
  return t('media.systemFolderDeleteImpact.general', { name })
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
