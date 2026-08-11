import { useCallback, useEffect, useMemo, useState } from 'react'

export const PRODUCT_EXPORT_HEADERS = [
  'id', 'legacy_id', 'sku', 'slug', 'slug_en', 'name_vi', 'name_en',
  'short_description_vi', 'short_description_en', 'description_vi', 'description_en',
  'category_ids', 'category_slugs', 'category_names_vi', 'category_names_en',
  'brand_id', 'brand_slug', 'brand_name', 'image_id', 'image_url', 'image_alt',
  'image_width', 'image_height', 'image_mime_type', 'retail_price', 'sale_price',
  'currency', 'stock_state', 'stock_quantity', 'manage_stock', 'backorders',
  'length_cm', 'width_cm', 'height_cm', 'available', 'discount_percent_override',
  'publish_status', 'homepage_block', 'homepage_order', 'rating', 'rating_count',
  'pdp_shipping_line', 'pdp_return_line', 'origin_brand_country_vi',
  'origin_brand_country_en', 'size_guide_vi', 'size_guide_en',
  'suitability_advisory_vi', 'suitability_advisory_en', 'specifications_vi',
  'specifications_en', 'spec_stats_vi', 'spec_stats_en', 'trust_badges_vi',
  'trust_badges_en', 'quick_answer_summary_vi', 'quick_answer_summary_en',
  'gender', 'seo_title_vi', 'seo_title_en', 'seo_description_vi',
  'seo_description_en', 'seo_canonical_url', 'seo_og_image_id', 'seo_og_image_url',
  'seo_og_image_alt', 'seo_og_image_width', 'seo_og_image_height',
  'seo_og_image_mime_type', 'created_at', 'updated_at', 'version',
  'description_blocks_json', 'suitability_section_json', 'size_guide_section_json',
  'faqs_json', 'commitments_json', 'highlights_json', 'gallery_json', 'videos_json',
  'variants_json', 'related_products_json', 'accessory_products_json',
]

const PRICING_COLUMNS = [
  'sku', 'name_vi', 'category_names_vi', 'brand_name', 'retail_price', 'sale_price',
  'currency', 'stock_state', 'stock_quantity', 'available', 'publish_status',
]

const CONTENT_SEO_COLUMNS = [
  'sku', 'name_vi', 'name_en', 'slug', 'slug_en', 'short_description_vi',
  'short_description_en', 'seo_title_vi', 'seo_title_en', 'seo_description_vi',
  'seo_description_en', 'seo_canonical_url',
]

const MEDIA_COLUMNS = ['sku', 'name_vi', 'image_url', 'image_alt', 'gallery_json', 'videos_json']

export const PRODUCT_EXPORT_PRESETS = [
  { key: 'PRICING', columns: PRICING_COLUMNS, labelKey: 'products.exportDialog.presets.pricing', descriptionKey: 'products.exportDialog.presetDescriptions.pricing' },
  { key: 'CONTENT_SEO', columns: CONTENT_SEO_COLUMNS, labelKey: 'products.exportDialog.presets.contentSeo', descriptionKey: 'products.exportDialog.presetDescriptions.contentSeo' },
  { key: 'MEDIA', columns: MEDIA_COLUMNS, labelKey: 'products.exportDialog.presets.media', descriptionKey: 'products.exportDialog.presetDescriptions.media' },
  { key: 'FULL', columns: PRODUCT_EXPORT_HEADERS, labelKey: 'products.exportDialog.presets.full', descriptionKey: 'products.exportDialog.presetDescriptions.full' },
]

export const PRODUCT_EXPORT_COLUMN_GROUPS = [
  {
    key: 'BASIC',
    labelKey: 'products.exportDialog.groups.basic',
    columns: ['id', 'legacy_id', 'sku', 'slug', 'slug_en', 'name_vi', 'name_en', 'created_at', 'updated_at', 'version'],
  },
  {
    key: 'CLASSIFICATION',
    labelKey: 'products.exportDialog.groups.classification',
    columns: ['category_ids', 'category_slugs', 'category_names_vi', 'category_names_en', 'brand_id', 'brand_slug', 'brand_name', 'gender'],
  },
  {
    key: 'PRICING_STOCK',
    labelKey: 'products.exportDialog.groups.pricingStock',
    columns: ['retail_price', 'sale_price', 'currency', 'stock_state', 'stock_quantity', 'manage_stock', 'backorders', 'length_cm', 'width_cm', 'height_cm', 'available', 'discount_percent_override'],
  },
  {
    key: 'CONTENT',
    labelKey: 'products.exportDialog.groups.content',
    columns: [
      'short_description_vi', 'short_description_en', 'description_vi', 'description_en',
      'pdp_shipping_line', 'pdp_return_line', 'origin_brand_country_vi', 'origin_brand_country_en',
      'size_guide_vi', 'size_guide_en', 'suitability_advisory_vi', 'suitability_advisory_en',
      'specifications_vi', 'specifications_en', 'spec_stats_vi', 'spec_stats_en',
      'trust_badges_vi', 'trust_badges_en', 'quick_answer_summary_vi', 'quick_answer_summary_en',
      'description_blocks_json', 'suitability_section_json', 'size_guide_section_json',
      'faqs_json', 'commitments_json', 'highlights_json',
    ],
  },
  {
    key: 'SEO',
    labelKey: 'products.exportDialog.groups.seo',
    columns: ['seo_title_vi', 'seo_title_en', 'seo_description_vi', 'seo_description_en', 'seo_canonical_url', 'seo_og_image_id', 'seo_og_image_url', 'seo_og_image_alt', 'seo_og_image_width', 'seo_og_image_height', 'seo_og_image_mime_type'],
  },
  {
    key: 'MEDIA_VIDEO',
    labelKey: 'products.exportDialog.groups.mediaVideo',
    columns: ['image_id', 'image_url', 'image_alt', 'image_width', 'image_height', 'image_mime_type', 'gallery_json', 'videos_json'],
  },
  {
    key: 'VARIANTS',
    labelKey: 'products.exportDialog.groups.variants',
    columns: ['variants_json'],
  },
  {
    key: 'RELATED_PRODUCTS',
    labelKey: 'products.exportDialog.groups.relatedProducts',
    columns: ['related_products_json', 'accessory_products_json'],
  },
  {
    key: 'DISPLAY_RATING',
    labelKey: 'products.exportDialog.groups.displayRating',
    columns: ['publish_status', 'homepage_block', 'homepage_order', 'rating', 'rating_count'],
  },
]

const DEFAULT_PREFERENCES = Object.freeze({
  preset: 'PRICING',
  columns: null,
  includeDraft: false,
  includeTrash: false,
})

export function columnsForPreset(preset) {
  return PRODUCT_EXPORT_PRESETS.find((item) => item.key === preset)?.columns || PRICING_COLUMNS
}

function normalizePreferences(value) {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PREFERENCES }
  const preset = PRODUCT_EXPORT_PRESETS.some((item) => item.key === value.preset) ? value.preset : DEFAULT_PREFERENCES.preset
  const columns = Array.isArray(value.columns)
    ? [...new Set(value.columns.filter((column) => PRODUCT_EXPORT_HEADERS.includes(column)))]
    : null
  return {
    preset,
    columns: columns ? (columns.includes('sku') ? columns : ['sku', ...columns]) : null,
    includeDraft: value.includeDraft === true,
    includeTrash: value.includeTrash === true,
  }
}

function readPreferences(storageKey) {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES }
  try {
    return normalizePreferences(JSON.parse(window.localStorage.getItem(storageKey) || 'null'))
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

/** Persist export choices per browser user, never in the shared backend. */
export function useProductExportPreferences(adminUserId) {
  const storageKey = useMemo(
    () => `bigbike:product-export:v1:${String(adminUserId || 'unknown')}`,
    [adminUserId],
  )
  const [preferences, setPreferences] = useState(() => readPreferences(storageKey))

  useEffect(() => {
    // The route can remain mounted while the authenticated admin changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferences(readPreferences(storageKey))
  }, [storageKey])

  const updatePreferences = useCallback((patch) => {
    setPreferences((previous) => {
      const next = normalizePreferences({ ...previous, ...patch })
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Private browsing or a blocked storage quota should not break exporting.
      }
      return next
    })
  }, [storageKey])

  return { preferences, updatePreferences, storageKey }
}
