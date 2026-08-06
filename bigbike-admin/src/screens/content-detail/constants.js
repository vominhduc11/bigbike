// Constants and pure helpers for ContentDetailScreen.
// Extracted from ContentDetailScreen.jsx to keep the screen file focused on behaviour
// and to satisfy fast-refresh (non-component exports live in .js).

import { generateId } from '@/lib/utils'

// Content chỉ còn ARTICLE (PAGE đã gỡ khỏi backend) — luôn resolve về ARTICLE/articles.
export function normalizeContentType(_value) {
  return 'ARTICLE'
}

export function mutationPath(_contentType) {
  return 'articles'
}

function resolveArticleStorefrontBase() {
  const raw = import.meta.env.VITE_STOREFRONT_BASE_URL
  if (raw) {
    try {
      const host = new URL(raw).hostname
      if (host === 'localhost' || host === '127.0.0.1') {
        return `${raw.replace(/\/$/, '')}/tin-tuc`
      }
    } catch {
      // Invalid preview URL: canonical must still fall back to the production host.
    }
  }
  return 'https://bigbike.vn/tin-tuc'
}

const ARTICLE_STOREFRONT_BASE = resolveArticleStorefrontBase()

export function canonicalUrlFromSlug(slug) {
  const normalized = String(slug || '').trim()
  return normalized ? `${ARTICLE_STOREFRONT_BASE}/${normalized}/` : null
}

// Validation-error field prefixes per section key — single source of truth
// for derived `sectionErrors` and tab-error counts.
export const SECTION_FIELD_PREFIXES = {
  basic:   ['title', 'slug', 'excerpt', 'translations.en.title', 'translations.en.slug', 'translations.en.excerpt'],
  body:    ['body', 'bodyBlocks', 'translations.en.body'],
  media:   ['coverImageUrl'],
  seo:     ['seoTitle', 'seoDescription', 'seoOgImageUrl', 'translations.en.seoTitle', 'translations.en.seoDescription'],
  publish: ['publishStatus'],
}

// Group the 5 sections into 2 fixed tabs to mirror writer vs publisher workflows.
export const TAB_SECTIONS = {
  content: ['basic', 'body', 'media', 'publish'],
  seo:     ['seo'],
}

export function computeSectionErrorsFromMap(errors) {
  const keys = Object.keys(errors)
  const result = {}
  for (const [section, prefixes] of Object.entries(SECTION_FIELD_PREFIXES)) {
    result[section] = prefixes.some((p) => keys.some((k) => k === p || k.startsWith(p + '.')))
  }
  return result
}

export function findTabForErrors(sectionErrors) {
  for (const [tab, keys] of Object.entries(TAB_SECTIONS)) {
    if (keys.some((k) => sectionErrors[k])) return tab
  }
  return null
}

// Map publishStatus → matching .bb-badge variant. Used in ScreenHeader.
export function publishBadgeClass(status) {
  switch (status) {
    case 'PUBLISHED': return 'bb-badge bb-badge-success'
    case 'DRAFT':     return 'bb-badge bb-badge-neutral'
    case 'HIDDEN':    return 'bb-badge bb-badge-warning'
    case 'TRASH':     return 'bb-badge bb-badge-danger'
    default:          return 'bb-badge bb-badge-neutral'
  }
}

// Slugify dùng chung — tách sang src/lib/slug.js (khử trùng lặp với Category/Brand).
export { toSlug } from '../../lib/slug'

export function buildEmptyForm(contentType) {
  return {
    slug: '',
    title: '',
    excerpt: '',
    body: '',
    publishStatus: 'DRAFT',
    featured: false,
    homeExperience: false,
    seoNoIndex: false,
    coverImageUrl: '',
    coverImageAlt: '',
    coverImageWidth: null,
    coverImageHeight: null,
    coverImageMimeType: '',
    productImageUrl: '',
    productImageAlt: '',
    bodyBlocks: null,
    seoTitle: '',
    seoDescription: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    seoOgImageWidth: null,
    seoOgImageHeight: null,
    seoOgImageMimeType: '',
    type: normalizeContentType(contentType),
    translations: {
      en: { slug: '', title: '', excerpt: '', body: '', seoTitle: '', seoDescription: '' },
    },
  }
}

export function buildFormFromItem(contentType, item) {
  const fallback = buildEmptyForm(contentType)
  if (!item) return fallback
  return {
    ...fallback,
    slug: item.slug || '',
    title: item.title || '',
    excerpt: item.excerpt || '',
    body: item.body || '',
    publishStatus: item.publishStatus === 'UNKNOWN' ? 'DRAFT' : item.publishStatus,
    featured: Boolean(item.featured),
    homeExperience: Boolean(item.homeExperience),
    seoNoIndex: Boolean(item.seo?.noIndex),
    coverImageUrl: item.coverImage?.rawUrl || item.coverImage?.url || '',
    coverImageAlt: item.coverImage?.alt || '',
    coverImageWidth: item.coverImage?.width ?? null,
    coverImageHeight: item.coverImage?.height ?? null,
    coverImageMimeType: item.coverImage?.mimeType || '',
    productImageUrl: item.productImage?.rawUrl || item.productImage?.url || '',
    productImageAlt: item.productImage?.alt || '',
    bodyBlocks: Array.isArray(item.bodyBlocks)
      ? item.bodyBlocks.map((b) => (b._key ? b : { ...b, _key: generateId() }))
      : null,
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoOgImageUrl: item.seo?.ogImage?.rawUrl || item.seo?.ogImage?.url || '',
    seoOgImageAlt: item.seo?.ogImage?.alt || '',
    seoOgImageWidth: item.seo?.ogImage?.width ?? null,
    seoOgImageHeight: item.seo?.ogImage?.height ?? null,
    seoOgImageMimeType: item.seo?.ogImage?.mimeType || '',
    type: normalizeContentType(item.type || contentType),
    translations: {
      en: {
        // slug tiếng Anh nằm ở field top-level `slugEn` của response, không trong translations.en
        slug: item.slugEn || '',
        title: item.translations?.en?.title || '',
        excerpt: item.translations?.en?.excerpt || '',
        body: item.translations?.en?.body || '',
        seoTitle: item.translations?.en?.seoTitle || '',
        seoDescription: item.translations?.en?.seoDescription || '',
      },
    },
  }
}

export const AUTOSAVE_TTL_MS = 60 * 60 * 1000

export function getAutosaveKey(contentType, contentId, isCreate) {
  return `content-autosave:${contentType.toLowerCase()}:${isCreate ? 'new' : contentId}`
}

export function saveFormToStorage(key, form) {
  try {
    localStorage.setItem(key, JSON.stringify({ form, ts: Date.now() }))
  } catch { /* quota */ }
}

export function loadFormFromStorage(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || Date.now() - parsed.ts > AUTOSAVE_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch { return null }
}

export function clearFormFromStorage(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// Filters out blocks that would fail Bean Validation on the backend (e.g. heading
// with empty text imported from WordPress). Keeps the save working without losing
// real content.
export function isBlockValid(block) {
  if (!block || !block.type) return false
  switch (block.type) {
    case 'heading':  return Boolean(block.text && block.text.trim())
    case 'paragraph': return block.html != null
    case 'list':     return Array.isArray(block.items) && block.items.length > 0
    case 'image':    return Boolean(block.url && block.url.trim())
    case 'video':    return Boolean(block.url && block.url.trim())
    case 'callout':  return block.html != null
    default:         return true
  }
}

// P1-001: Always emit fields that can be cleared so backend can distinguish
// "omitted = keep" vs "sent = apply (possibly clear)".
export function toPayload(form, _isCreate) {
  const payload = {
    slug: form.slug.trim(),
    title: form.title.trim(),
    publishStatus: form.publishStatus,
    // bodyBlocks presence-flag: send when non-null so backend overwrites both body_blocks + body columns.
    // When null (new form, no blocks added yet) omit so backend leaves columns unchanged.
    bodyBlocks: form.bodyBlocks !== null
      ? form.bodyBlocks.map(({ _key: _k, ...rest }) => {
          if (rest.type === 'image' || rest.type === 'feature') {
            const { alt: _alt, ...keep } = rest
            return keep
          }
          if (rest.type === 'video' && !['youtube', 'upload'].includes(rest.provider)) {
            return { ...rest, provider: undefined }
          }
          return rest
        }).filter(isBlockValid)
      : undefined,
  }

  // Legacy content fallback: WordPress-imported articles/pages created before the block
  // editor have body_blocks = null and carry content only in `body` HTML. When there are no
  // structured blocks, send that HTML so preview & save still have content — the backend
  // requires `body` OR `bodyBlocks` (docs/engineering/API_CONTRACT.md §"Article / Page body
  // blocks", line "Tạo mới: chấp nhận hoặc body hoặc bodyBlocks"). Without this the preview
  // dry-run returns 400 "Body is required." (field=body) and the iframe stays blank. When
  // blocks exist the server renders `body` from them, so we omit `body` here.
  if (form.bodyBlocks === null && form.body && form.body.trim()) {
    payload.body = form.body
  }

  // Empty strings are deliberate presence flags: excerpt and images can be cleared.
  payload.excerpt = form.excerpt.trim()
  payload.coverImage = form.coverImageUrl.trim()
    ? {
        url: form.coverImageUrl.trim(),
        alt: form.coverImageAlt?.trim() || null,
        width: Number.isFinite(form.coverImageWidth) ? form.coverImageWidth : null,
        height: Number.isFinite(form.coverImageHeight) ? form.coverImageHeight : null,
        mimeType: form.coverImageMimeType?.trim() || null,
      }
    : { url: '' }
  payload.productImage = form.productImageUrl.trim()
    ? { url: form.productImageUrl.trim(), alt: form.productImageAlt?.trim() || null }
    : { url: '' }

  payload.featured = Boolean(form.featured)
  payload.homeExperience = Boolean(form.homeExperience)

  // Always send seo as non-null object so backend can clear fields when all are empty
  payload.seo = {
    title: form.seoTitle.trim() || null,
    description: form.seoDescription.trim() || null,
    canonicalUrl: canonicalUrlFromSlug(form.slug),
    ogImage: form.seoOgImageUrl.trim()
      ? {
          url: form.seoOgImageUrl.trim(),
          alt: form.seoOgImageAlt?.trim() || null,
          width: Number.isFinite(form.seoOgImageWidth) ? form.seoOgImageWidth : null,
          height: Number.isFinite(form.seoOgImageHeight) ? form.seoOgImageHeight : null,
          mimeType: form.seoOgImageMimeType?.trim() || null,
        }
      : null,
    // noindex toggle — gửi boolean trong object seo cùng các field SEO khác.
    noIndex: Boolean(form.seoNoIndex),
  }

  payload.translations = {
    en: {
      slug: form.translations?.en?.slug?.trim() || null,
      title: form.translations?.en?.title?.trim() || null,
      excerpt: form.translations?.en?.excerpt?.trim() || null,
      body: form.translations?.en?.body?.trim() || null,
      seoTitle: form.translations?.en?.seoTitle?.trim() || null,
      seoDescription: form.translations?.en?.seoDescription?.trim() || null,
    },
  }

  return payload
}
