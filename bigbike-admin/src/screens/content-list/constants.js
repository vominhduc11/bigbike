export const ARTICLE_TYPE = 'ARTICLE'

export const INITIAL_CONTENT_QUERY = {
  search: '',
  type: ARTICLE_TYPE,
  publishStatus: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 20,
}

export const CONTENT_SORT_OPTIONS = [
  ['updatedAt:desc', 'content.sort.updatedNewest'],
  ['updatedAt:asc', 'content.sort.updatedOldest'],
  ['createdAt:desc', 'content.sort.createdNewest'],
  ['createdAt:asc', 'content.sort.createdOldest'],
  ['publishedAt:desc', 'content.sort.publishedNewest'],
  ['publishedAt:asc', 'content.sort.publishedOldest'],
  ['title:asc', 'content.sort.titleAz'],
  ['title:desc', 'content.sort.titleZa'],
  ['publishStatus:asc', 'content.sort.statusAsc'],
  ['publishStatus:desc', 'content.sort.statusDesc'],
]

export function contentDetailPath(item) {
  return `/admin/content/${String(item?.type || ARTICLE_TYPE).toLowerCase()}/${item?.id}`
}

export function isContentActionEligible(item, action) {
  const isTrashed = item?.publishStatus === 'TRASH'
  if (action === 'trash') return !isTrashed
  if (action === 'restore' || action === 'permanent') return isTrashed
  return false
}
