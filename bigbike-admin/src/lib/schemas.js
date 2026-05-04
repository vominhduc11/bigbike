import { z } from 'zod'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const URL_REGEX = /^https?:\/\//
// Media URLs may be absolute (http(s)://) or relative paths served by the
// /media/* proxy (e.g. "/media/foo.jpg"). The MediaPickerModal returns the
// latter, so image/gallery/video fields must accept both forms.
const MEDIA_URL_REGEX = /^(?:https?:\/\/|\/)/
const COLOR_ATTRIBUTE_KEYS = new Set(['color', 'colour', 'mau', 'mau sac', 'pa color', 'pa mau', 'pa mau sac'])

function normalizeVariantToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0110/g, 'D')
    .replace(/\u0111/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isColorAttributeName(name) {
  return COLOR_ATTRIBUTE_KEYS.has(normalizeVariantToken(name))
}

function slugField(t) {
  return z
    .string()
    .min(1, t('products.detail.errSlugRequired'))
    .regex(SLUG_REGEX, t('products.detail.errSlugFormat'))
}

// ── Product ───────────────────────────────────────────────────────────────────

function toInt(value) {
  const s = String(value ?? '').trim()
  if (!s) return undefined
  const n = Number(s)
  return Number.isInteger(n) ? n : Number.NaN
}

export function createProductSchema(t, isCreate = false) {
  return z
    .object({
      slug: slugField(t),
      name: z.string().min(1, t('products.detail.errNameRequired')),
      categoryId: z.string().min(1, t('products.detail.errCategoryRequired')),
      // Short description shows up directly on the PDP under the title.
      // Allow empty (optional) but if provided, demand enough characters
      // to actually describe the product — placeholder strings like
      // "abcde" / "test" leak into production otherwise.
      shortDescription: z.string().optional(),
      retailPrice: z.string().optional(),
      compareAtPrice: z.string().optional(),
      salePrice: z.string().optional(),
      stockState: z.string().min(1, t('products.detail.errStockRequired')),
      publishStatus: z.string().min(1, t('products.detail.errPublishRequired')),
      imageUrl: z.string().optional(),
      gallery: z.array(z.object({ url: z.string(), alt: z.string().optional() })).optional(),
      videos: z.array(z.object({
        url: z.string(),
        title: z.string(),
        type: z.enum(['youtube', 'upload']).optional(),
      })).optional(),
      specifications: z.array(z.object({
        _key: z.string().optional(),
        name: z.string().max(255, 'Tên thông số tối đa 255 ký tự.'),
        value: z.string().max(2000, 'Giá trị thông số tối đa 2000 ký tự.'),
        groupName: z.string().max(100, 'Tên nhóm tối đa 100 ký tự.'),
      })).optional(),
      variants: z.array(z.object({
        name: z.string(),
        imageUrl: z.string().optional(),
        options: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
        gallery: z.array(z.object({ url: z.string(), alt: z.string().optional() })).optional(),
      })).optional(),
    })
    .superRefine((data, ctx) => {
      const retail = toInt(data.retailPrice)
      const compare = toInt(data.compareAtPrice)
      const sale = toInt(data.salePrice)

      // retailPrice required on create — variant-level prices are no longer
      // collected, so the parent product price is the single source of truth.
      if (isCreate && retail === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errRetailPriceRequired'), path: ['retailPrice'] })
      }
      if (Number.isNaN(retail)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errRetailPriceInt'), path: ['retailPrice'] })
      }
      if (Number.isNaN(compare)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errCompareAtPriceInt'), path: ['compareAtPrice'] })
      }
      if (Number.isNaN(sale)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errSalePriceInt'), path: ['salePrice'] })
      }
      if (Number.isInteger(sale) && Number.isInteger(retail) && (sale >= retail || (Number.isInteger(compare) && sale >= compare))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errSalePriceHigh'), path: ['salePrice'] })
      }
      if (data.imageUrl?.trim() && !MEDIA_URL_REGEX.test(data.imageUrl.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errImageUrl'), path: ['imageUrl'] })
      }
      // Short description quality: when filled, require enough text to be
      // useful on the PDP. Empty is allowed (PDP just hides the row).
      const desc = (data.shortDescription ?? '').trim()
      if (desc.length > 0 && desc.length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('products.detail.errShortDescriptionTooShort'),
          path: ['shortDescription'],
        })
      }

      // Specifications: rows that have any content must have both name and value.
      data.specifications?.forEach((s, i) => {
        const name = (s.name || '').trim()
        const value = (s.value || '').trim()
        const group = (s.groupName || '').trim()
        if (!name && !value && !group) return
        if (!name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập tên thông số.', path: ['specifications', i, 'name'] })
        if (!value) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập giá trị thông số.', path: ['specifications', i, 'value'] })
      })

      // Validate gallery URLs
      data.gallery?.forEach((img, i) => {
        if (img.url.trim() && !MEDIA_URL_REGEX.test(img.url.trim())) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errImageUrl'), path: ['gallery', i, 'url'] })
        }
      })

      // Validate video URLs per source type.
      // YouTube rows must parse a video ID (covers watch, share, embed, shorts).
      // Library rows must be a media URL — http(s):// or /-prefixed proxy path.
      data.videos?.forEach((v, i) => {
        const url = (v.url || '').trim()
        const title = (v.title || '').trim()
        if (!url) {
          if (title) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập URL hoặc xoá hàng video này.', path: ['videos', i, 'url'] })
          }
          return
        }
        if (v.type === 'upload') {
          if (!MEDIA_URL_REGEX.test(url)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'URL video không hợp lệ.', path: ['videos', i, 'url'] })
          }
          return
        }
        // Default to YouTube: parse YouTube ID using same regex as the editor.
        if (!/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))[A-Za-z0-9_-]{11}/.test(url)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'URL YouTube không hợp lệ. Hỗ trợ youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…', path: ['videos', i, 'url'] })
        }
      })

      // Validate variants.
      // imageUrl and gallery are color-scoped: withColorScopedMedia copies the
      // same values to every variant in a color group, so validating each copy
      // would produce duplicate badges on every sibling. Only report media
      // errors on the first variant of each color group; name is per-variant.
      const seenColorGroups = new Set()

      data.variants?.forEach((v, i) => {
        if (!v.name.trim()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Tên biến thể là bắt buộc', path: ['variants', i, 'name'] })
        }

        const colorValue = (v.options || [])
          .find((o) => isColorAttributeName(o.name) && String(o.value || '').trim())
          ?.value?.trim() || ''
        const colorKey = colorValue ? normalizeVariantToken(colorValue) : null
        const isFirstOfColorGroup = colorKey ? !seenColorGroups.has(colorKey) : true
        if (colorKey) seenColorGroups.add(colorKey)

        if (!isFirstOfColorGroup) return

        if (v.imageUrl?.trim() && !MEDIA_URL_REGEX.test(v.imageUrl.trim())) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errImageUrl'), path: ['variants', i, 'imageUrl'] })
        }
        const hasColor = Boolean(colorValue)
        const hasVariantGallery = v.gallery?.some((img) => img.url.trim()) ?? false
        if (hasVariantGallery && !hasColor) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Gallery biến thể chỉ áp dụng theo Màu/Color. Hãy thêm thuộc tính màu hoặc dùng gallery chung của sản phẩm.',
            path: ['variants', i, 'gallery'],
          })
        }
        v.gallery?.forEach((img, j) => {
          if (img.url.trim() && !MEDIA_URL_REGEX.test(img.url.trim())) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errImageUrl'), path: ['variants', i, 'gallery', j, 'url'] })
          }
        })
      })
    })
}

// ── Category ──────────────────────────────────────────────────────────────────

export function createCategorySchema(t) {
  return z
    .object({
      slug: z.string(),
      name: z.string().min(1, t('categories.detail.errNameRequired')),
      imageUrl: z.string().optional(),
      iconUrl: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const s = String(data.slug || '').trim()
      if (!s) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errSlugRequired'), path: ['slug'] })
      } else if (!SLUG_REGEX.test(s)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errSlugFormat'), path: ['slug'] })
      }
      if (data.imageUrl?.trim() && !MEDIA_URL_REGEX.test(data.imageUrl.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errImageUrl'), path: ['imageUrl'] })
      }
      if (data.iconUrl?.trim() && !MEDIA_URL_REGEX.test(data.iconUrl.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errIconUrl'), path: ['iconUrl'] })
      }
    })
}

// ── Brand ─────────────────────────────────────────────────────────────────────

export function createBrandSchema(t) {
  return z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string().optional(),
    logoUrl: z.string().optional(),
    seoCanonicalUrl: z.string().optional(),
    seoOgImageUrl: z.string().optional(),
  }).superRefine((data, ctx) => {
    const s = String(data.slug || '').trim()
    if (!s) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('brands.detail.errSlugRequired'), path: ['slug'] })
    } else if (!SLUG_REGEX.test(s)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('brands.detail.errSlugFormat'), path: ['slug'] })
    }
    if (!data.name?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('brands.detail.errNameRequired'), path: ['name'] })
    }
    if ((data.description || '').length > 5000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('brands.detail.errDescriptionTooLong'), path: ['description'] })
    }
    if (data.logoUrl?.trim() && !MEDIA_URL_REGEX.test(data.logoUrl.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('brands.detail.errLogoUrl'), path: ['logoUrl'] })
    }
    if (data.seoCanonicalUrl?.trim() && !URL_REGEX.test(data.seoCanonicalUrl.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('brands.detail.errSeoCanonicalUrl'), path: ['seoCanonicalUrl'] })
    }
    if (data.seoOgImageUrl?.trim() && !MEDIA_URL_REGEX.test(data.seoOgImageUrl.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('brands.detail.errSeoOgImageUrl'), path: ['seoOgImageUrl'] })
    }
  })
}

// ── Content ───────────────────────────────────────────────────────────────────

export function createContentSchema(t, isCreate, normalizedType) {
  return z.object({
    slug: z.string(),
    title: z.string(),
    body: z.string(),
    publishStatus: z.string(),
    pageType: z.string().optional(),
    coverImageUrl: z.string().optional(),
    productImageUrl: z.string().optional(),
    seoCanonicalUrl: z.string().optional(),
    seoOgImageUrl: z.string().optional(),
  }).superRefine((data, ctx) => {
    const s = String(data.slug || '').trim()
    if (!s) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('content.detail.errSlugRequired'), path: ['slug'] })
    } else if (!SLUG_REGEX.test(s)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('content.detail.errSlugFormat'), path: ['slug'] })
    }
    if (!data.title?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('content.detail.errTitleRequired'), path: ['title'] })
    }
    if (!data.body?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('content.detail.errBodyRequired'), path: ['body'] })
    }
    if (!data.publishStatus) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('content.detail.errPublishRequired'), path: ['publishStatus'] })
    }
    if (normalizedType === 'PAGE' && isCreate && !data.pageType?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('content.detail.errPageTypeRequired'), path: ['pageType'] })
    }
    if (data.coverImageUrl?.trim() && !MEDIA_URL_REGEX.test(data.coverImageUrl.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('content.detail.errCoverImageUrl'), path: ['coverImageUrl'] })
    }
    if (data.productImageUrl?.trim() && !MEDIA_URL_REGEX.test(data.productImageUrl.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('content.detail.errProductImageUrl'), path: ['productImageUrl'] })
    }
    if (data.seoCanonicalUrl?.trim() && !URL_REGEX.test(data.seoCanonicalUrl.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('content.detail.errSeoCanonicalUrl'), path: ['seoCanonicalUrl'] })
    }
    if (data.seoOgImageUrl?.trim() && !MEDIA_URL_REGEX.test(data.seoOgImageUrl.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('content.detail.errSeoOgImageUrl'), path: ['seoOgImageUrl'] })
    }
  })
}

// ── Zod error → field errors map ──────────────────────────────────────────────
// Handles both top-level fields and nested paths (e.g. variants.0.name).

export function zodErrors(result) {
  if (result.success) return {}
  const out = {}
  for (const issue of result.error.issues) {
    if (!issue.path.length) continue
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
