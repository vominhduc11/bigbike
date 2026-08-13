// Query defaults and homepage-block lookup tables for ProductListScreen.
// Extracted from ProductListScreen.jsx to keep the screen file focused on behaviour.

import { buildCategoryTreeOrder } from '../product-detail/constants'

export { buildCategoryTreeOrder }

export const INITIAL_QUERY = {
  search: '',
  publishStatus: 'ALL',
  stockState: 'ALL',
  brandId: '',
  categoryId: '',
  gender: '',
  homepageBlock: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 20,
}

export const HOMEPAGE_BLOCK_LIMITS = {
  FEATURED_GRID: 12,
}

export const HOMEPAGE_BLOCK_LABEL_KEYS = {
  NONE: 'products.hbNone',
  FEATURED_GRID: 'products.hbFeatured',
}

// Pure helper (kept out of the .jsx cell file so fast-refresh stays component-only).
export function categoryLabel(product, fallbackLabel = '') {
  const category = product.category
  return category?.name || fallbackLabel
}
