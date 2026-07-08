// Constants + pure helpers for MediaLibraryScreen.
// Kept in a plain .js file so fast-refresh stays component-only in the .jsx parts.

export const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'video/mp4',
]
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
export const PAGE_SIZE_OPTIONS = [12, 24, 48, 96]

export const DEFAULT_QUERY = {
  search: '', mimeType: 'ALL', status: 'ACTIVE', usageFilter: 'ALL',
  uploadedFrom: '', uploadedTo: '',
  minSize: '', maxSize: '',
  minWidth: '', minHeight: '',
  sort: 'createdAt', dir: 'desc',
  view: 'grid',
  folderFilter: '', tag: '',
  page: 1, pageSize: 24,
}

export { formatBytes } from '../../components/media-picker/pickerUtils'

export function formatNumber(n) {
  return new Intl.NumberFormat('vi-VN').format(n ?? 0)
}

export function dateToInstantStart(d) { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return Number.isNaN(x.getTime()) ? '' : x.toISOString() }
export function dateToInstantEnd(d) { if (!d) return ''; const x = new Date(d + 'T00:00:00'); if (Number.isNaN(x.getTime())) return ''; x.setDate(x.getDate() + 1); return x.toISOString() }

export function hasAdvancedFilters(q) {
  return Boolean(q.uploadedFrom || q.uploadedTo || q.minSize || q.maxSize || q.minWidth || q.minHeight)
}

export function buildActiveChips(query, t, folders, onRemove) {
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
