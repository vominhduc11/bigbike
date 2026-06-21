// Constants and pure helpers for ContentDetailScreen.
// Extracted from ContentDetailScreen.jsx to keep the screen file focused on behaviour
// and to satisfy fast-refresh (non-component exports live in .js).

import { generateId } from '@/lib/utils'

export function findOptionById(items, id) {
  if (!id) return null
  return (items || []).find((item) => item?.id === id) || null
}

export function prependSelectedOption(items, selected) {
  if (!selected?.id || findOptionById(items, selected.id)) return items
  return [selected, ...items]
}

export function normalizeContentType(value) {
  return String(value || '').toUpperCase() === 'PAGE' ? 'PAGE' : 'ARTICLE'
}

export function mutationPath(contentType) {
  return normalizeContentType(contentType) === 'PAGE' ? 'pages' : 'articles'
}

// Validation-error field prefixes per section key — single source of truth
// for derived `sectionErrors` and tab-error counts.
export const SECTION_FIELD_PREFIXES = {
  basic:   ['title', 'slug', 'pageType', 'categoryId', 'excerpt'],
  body:    ['body', 'bodyBlocks'],
  media:   ['coverImageUrl', 'heroImage'],
  seo:     ['seoTitle', 'seoDescription', 'seoCanonicalUrl', 'seoOgImageUrl'],
  publish: ['publishStatus'],
}

// Group the 5 sections into 2 fixed tabs to mirror writer vs publisher workflows.
export const TAB_SECTIONS = {
  content: ['basic', 'body', 'media'],
  seo:     ['seo', 'publish'],
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

// Slugify cho gợi ý đường dẫn tiếng Anh của BÀI VIẾT (bỏ dấu, kebab-case).
// Khớp toSlug của các màn catalog (Category/Brand DetailScreen).
export function toSlug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function buildEmptyForm(contentType) {
  return {
    slug: '',
    title: '',
    excerpt: '',
    body: '',
    publishStatus: 'DRAFT',
    featured: false,
    seoNoIndex: false,
    pageType: 'CUSTOM',
    categoryId: '',
    parentId: '',
    coverImageUrl: '',
    coverImageAlt: '',
    productImageUrl: '',
    productImageAlt: '',
    bodyBlocks: null,
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    heroImageUrl: '',
    heroTitle: '',
    type: normalizeContentType(contentType),
    translations: {
      en: { slug: '', title: '', excerpt: '', body: '', seoTitle: '', seoDescription: '', heroTitle: '' },
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
    seoNoIndex: Boolean(item.seo?.noIndex),
    pageType: item.pageType || fallback.pageType,
    categoryId: item.categoryId || '',
    parentId: item.parentId || '',
    coverImageUrl: item.coverImage?.url || '',
    coverImageAlt: item.coverImage?.alt || '',
    productImageUrl: item.productImage?.url || '',
    productImageAlt: item.productImage?.alt || '',
    bodyBlocks: Array.isArray(item.bodyBlocks)
      ? item.bodyBlocks.map((b) => (b._key ? b : { ...b, _key: generateId() }))
      : null,
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoOgImageUrl: item.seo?.ogImage?.url || '',
    seoOgImageAlt: item.seo?.ogImage?.alt || '',
    heroImageUrl: item.heroImage?.url || '',
    heroTitle: item.heroTitle || '',
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
        heroTitle: item.translations?.en?.heroTitle || '',
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
export function toPayload(form, isCreate) {
  const payload = {
    slug: form.slug.trim(),
    title: form.title.trim(),
    publishStatus: form.publishStatus,
    // bodyBlocks presence-flag: send when non-null so backend overwrites both body_blocks + body columns.
    // When null (new form, no blocks added yet) omit so backend leaves columns unchanged.
    bodyBlocks: form.bodyBlocks !== null
      ? form.bodyBlocks.map(({ _key: _k, ...rest }) => rest).filter(isBlockValid)
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

  if (form.type === 'ARTICLE') {
    payload.excerpt = form.excerpt.trim() || undefined

    // Always send coverImage so clearing a URL removes it on backend
    payload.coverImage = form.coverImageUrl.trim()
      ? { url: form.coverImageUrl.trim(), alt: form.coverImageAlt.trim() || undefined }
      : { url: '' }

    // Always send productImage so clearing a URL removes it on backend
    payload.productImage = form.productImageUrl.trim()
      ? { url: form.productImageUrl.trim(), alt: form.productImageAlt.trim() || undefined }
      : { url: '' }

    // Always send categoryId — empty string clears the category
    payload.categoryId = form.categoryId || ''

    // Bài viết nổi bật — chỉ áp dụng cho ARTICLE; gửi boolean để backend áp dụng.
    payload.featured = Boolean(form.featured)
  }

  if (form.type === 'PAGE') {
    if (isCreate) {
      payload.pageType = form.pageType.trim()
    }
    // Always send parentId — empty string clears the parent
    payload.parentId = form.parentId || ''

    // Hero — always send so admin can clear by leaving blank.
    // Empty url is accepted by backend (@Pattern allows empty) and treated as "clear".
    payload.heroImage = form.heroImageUrl.trim()
      ? { url: form.heroImageUrl.trim() }
      : { url: '' }
    payload.heroTitle = form.heroTitle.trim() || ''
  }

  // Always send seo as non-null object so backend can clear fields when all are empty
  payload.seo = {
    title: form.seoTitle.trim() || null,
    description: form.seoDescription.trim() || null,
    canonicalUrl: form.seoCanonicalUrl.trim() || null,
    ogImage: form.seoOgImageUrl.trim()
      ? { url: form.seoOgImageUrl.trim(), alt: form.seoOgImageAlt.trim() || undefined }
      : null,
    // noindex toggle — gửi boolean trong object seo cùng các field SEO khác.
    noIndex: Boolean(form.seoNoIndex),
  }

  payload.translations = {
    en: {
      // English URL slug chỉ áp dụng cho BÀI VIẾT (ARTICLE_RULE_003); trang tĩnh không gửi.
      ...(form.type === 'ARTICLE'
        ? { slug: form.translations?.en?.slug?.trim() || null }
        : {}),
      title: form.translations?.en?.title?.trim() || null,
      excerpt: form.translations?.en?.excerpt?.trim() || null,
      body: form.translations?.en?.body?.trim() || null,
      seoTitle: form.translations?.en?.seoTitle?.trim() || null,
      seoDescription: form.translations?.en?.seoDescription?.trim() || null,
      heroTitle: form.translations?.en?.heroTitle?.trim() || null,
    },
  }

  return payload
}
