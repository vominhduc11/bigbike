// Constants + pure helpers for MediaLibraryScreen.
// Kept in a plain .js file so fast-refresh stays component-only in the .jsx parts.

import { MAX_MEDIA_UPLOAD_BYTES, MEDIA_UPLOAD_MIME_TYPES } from '../../lib/mediaConstants'

export const ALLOWED_MIME = MEDIA_UPLOAD_MIME_TYPES
export const MAX_FILE_SIZE = MAX_MEDIA_UPLOAD_BYTES
export const PAGE_SIZE_OPTIONS = [12, 24, 48, 96]

export const DEFAULT_QUERY = {
  search: '',
  mimeType: 'ALL',
  status: 'ACTIVE',
  usageFilter: 'ALL',
  sort: 'createdAt',
  dir: 'desc',
  folderFilter: '',
  tag: '',
  page: 1,
  pageSize: 24,
}

export { formatBytes } from '../../components/media-picker/pickerUtils'

export function formatNumber(n) {
  return new Intl.NumberFormat('vi-VN').format(n ?? 0)
}

export function buildActiveChips(query, t, folders, onRemove) {
  const chips = []
  if (query.search)
    chips.push({
      key: 'search',
      label: `${t('common.search')}: ${query.search}`,
      onRemove: () => onRemove('search', ''),
    })
  if (query.mimeType !== 'ALL') {
    const label =
      query.mimeType === 'image/'
        ? t('media.images')
        : query.mimeType === 'video/'
          ? t('media.videos')
          : query.mimeType
    chips.push({
      key: 'mimeType',
      label: `${t('media.filterType')}: ${label}`,
      onRemove: () => onRemove('mimeType', 'ALL'),
    })
  }
  if (query.usageFilter !== 'ALL') {
    const label = query.usageFilter === 'USED' ? t('media.usageUsed') : t('media.usageUnusedOption')
    chips.push({
      key: 'usageFilter',
      label: `${t('media.filterUsage')}: ${label}`,
      onRemove: () => onRemove('usageFilter', 'ALL'),
    })
  }
  if (query.status !== DEFAULT_QUERY.status) {
    chips.push({
      key: 'status',
      label: `${t('media.filterStatus')}: ${query.status === 'DELETED' ? t('media.statusDeleted') : t('media.statusActive')}`,
      onRemove: () => onRemove('status', DEFAULT_QUERY.status),
    })
  }
  if (query.folderFilter) {
    const label =
      query.folderFilter === 'NONE'
        ? t('media.uncategorized')
        : ((folders || []).find((f) => f.id === query.folderFilter)?.name ?? query.folderFilter)
    chips.push({
      key: 'folderFilter',
      label: `${t('media.folder')}: ${label}`,
      onRemove: () => onRemove('folderFilter', ''),
    })
  }
  if (query.tag)
    chips.push({ key: 'tag', label: `#${query.tag}`, onRemove: () => onRemove('tag', '') })
  return chips
}
