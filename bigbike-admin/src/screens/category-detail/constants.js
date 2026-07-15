// Constants and pure form/helpers for CategoryDetailScreen.
// Extracted from CategoryDetailScreen.jsx to keep the screen file focused on behaviour.

export const STOREFRONT_BASE = `${import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn'}/danh-muc-san-pham`
export const MENU_NOTICE_DISMISSED_KEY = 'bigbike-admin-cat-menu-notice-dismissed'

// Slugify dùng chung — tách sang src/lib/slug.js (khử trùng lặp với Brand/Content).
export { toSlug } from '../../lib/slug'

export function buildEmptyForm() {
  return {
    slug: '',
    name: '',
    description: '',
    introContent: '',
    parentId: '',
    visible: true,
    showOnHomepage: false,
    imageUrl: '',
    bannerImageUrl: '',
    heroImageUrl: '',
    menuIconUrl: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    translations: { en: { slug: '', name: '', description: '', introContent: '', seoTitle: '', seoDescription: '' } },
  }
}

export function buildFormFromItem(item) {
  if (!item) return buildEmptyForm()
  return {
    slug: item.slug || '',
    name: item.name || '',
    description: item.description || '',
    introContent: item.introContent || '',
    parentId: item.parentId || '',
    visible: item.isVisible !== false,
    showOnHomepage: Boolean(item.showOnHomepage),
    imageUrl: item.image?.url || '',
    bannerImageUrl: item.bannerImage?.url || '',
    // Ảnh minh hoạ hero (WP ACF "image_left") nằm ở field `icon` của response, không phải `image`.
    heroImageUrl: item.icon?.url || '',
    menuIconUrl: item.menuIconUrl || '',
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoOgImageUrl: item.seo?.ogImage?.rawUrl || item.seo?.ogImage?.url || '',
    seoOgImageAlt: item.seo?.ogImage?.alt || '',
    translations: {
      en: {
        // slug tiếng Anh nằm ở field top-level `slugEn` của response, không trong translations.en
        slug: item.slugEn || '',
        name: item.translations?.en?.name || '',
        description: item.translations?.en?.description || '',
        introContent: item.translations?.en?.introContent || '',
        seoTitle: item.translations?.en?.seoTitle || '',
        seoDescription: item.translations?.en?.seoDescription || '',
      },
    },
  }
}

// ── Autosave utilities (F9) ──────────────────────────────────────────────────
// Mirrors product-detail/constants.js + content-detail/constants.js — same
// localStorage draft mechanism, own key namespace per screen.

export const AUTOSAVE_TTL_MS = 60 * 60 * 1000

export function getAutosaveKey(categoryId, isCreate) {
  return `category-autosave:${isCreate ? 'new' : categoryId}`
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

export function toPayload(form) {
  // sortOrder is intentionally omitted: category ordering is owned solely by the
  // drag-reorder on CategoryListScreen. The backend update preserves the existing
  // sortOrder when the field is absent (presence-flag: AdminCatalogMutationService
  // only sets it when non-null), so the detail form never clobbers the list order.
  const payload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    introContent: form.introContent.trim() || undefined,
    parentId: form.parentId.trim(),
    visible: Boolean(form.visible),
    showOnHomepage: Boolean(form.showOnHomepage),
  }

  const imageUrl = form.imageUrl.trim()
  payload.image = imageUrl ? { url: imageUrl } : { url: null }

  const bannerImageUrl = form.bannerImageUrl.trim()
  payload.banner = bannerImageUrl ? { url: bannerImageUrl } : { url: null }

  // Ảnh minh hoạ hero (WP ACF "image_left") → backend field `icon` (icon_url). Đây là ảnh
  // web hiển thị ở hero trang danh mục; KHÁC `image` (thumbnail lưới) và `menuIcon` (icon menu).
  const heroImageUrl = form.heroImageUrl.trim()
  payload.icon = heroImageUrl ? { url: heroImageUrl } : { url: null }

  // Icon line đơn sắc cho menu header + bộ lọc danh mục (lưu vào menu_icon_url).
  const menuIconUrl = form.menuIconUrl.trim()
  payload.menuIcon = menuIconUrl ? { url: menuIconUrl } : { url: null }

  const seoTitle = form.seoTitle.trim()
  const seoDescription = form.seoDescription.trim()
  const seoCanonicalUrl = form.seoCanonicalUrl.trim()
  const seoOgImageUrl = form.seoOgImageUrl.trim()
  payload.seo = {
    title: seoTitle || undefined,
    description: seoDescription || undefined,
    canonicalUrl: seoCanonicalUrl || undefined,
    ogImage: seoOgImageUrl
      ? { url: seoOgImageUrl }
      : null,
  }

  payload.translations = {
    en: {
      slug: form.translations?.en?.slug?.trim() || null,
      name: form.translations?.en?.name?.trim() || null,
      description: form.translations?.en?.description?.trim() || null,
      introContent: form.translations?.en?.introContent?.trim() || null,
      seoTitle: form.translations?.en?.seoTitle?.trim() || null,
      seoDescription: form.translations?.en?.seoDescription?.trim() || null,
    },
  }

  return payload
}
