// Constants and pure form/helpers for CategoryDetailScreen.
// Extracted from CategoryDetailScreen.jsx to keep the screen file focused on behaviour.

export const STOREFRONT_BASE = `${import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn'}/danh-muc`
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
    showOnHomepage: false,
    imageUrl: '',
    imageAlt: '',
    imageWidth: null,
    imageHeight: null,
    imageMimeType: '',
    bannerImageUrl: '',
    bannerImageAlt: '',
    mobileBannerImageUrl: '',
    mobileBannerImageAlt: '',
    heroImageUrl: '',
    heroImageAlt: '',
    heroImageWidth: null,
    heroImageHeight: null,
    heroImageMimeType: '',
    menuIconUrl: '',
    seoTitle: '',
    seoDescription: '',
    seoNoIndex: false,
    seoNoIndexEn: false,
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    seoOgImageWidth: null,
    seoOgImageHeight: null,
    seoOgImageMimeType: '',
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
    showOnHomepage: Boolean(item.showOnHomepage),
    imageUrl: item.image?.rawUrl || item.image?.url || '',
    imageAlt: item.image?.alt || '',
    imageWidth: item.image?.width ?? null,
    imageHeight: item.image?.height ?? null,
    imageMimeType: item.image?.mimeType || '',
    bannerImageUrl: item.bannerImage?.rawUrl || item.bannerImage?.url || '',
    bannerImageAlt: item.bannerImage?.alt || '',
    mobileBannerImageUrl: item.mobileBannerImage?.rawUrl || item.mobileBannerImage?.url || '',
    mobileBannerImageAlt: item.mobileBannerImage?.alt || '',
    // Ảnh minh hoạ hero (WP ACF "image_left") nằm ở field `icon` của response, không phải `image`.
    heroImageUrl: item.icon?.rawUrl || item.icon?.url || '',
    heroImageAlt: item.icon?.alt || '',
    heroImageWidth: item.icon?.width ?? null,
    heroImageHeight: item.icon?.height ?? null,
    heroImageMimeType: item.icon?.mimeType || '',
    menuIconUrl: item.menuIconUrl || '',
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoNoIndex: Boolean(item.seo?.noIndex),
    seoNoIndexEn: Boolean(item.seo?.noIndexEn),
    seoOgImageUrl: item.seo?.ogImage?.rawUrl || item.seo?.ogImage?.url || '',
    seoOgImageAlt: item.seo?.ogImage?.alt || '',
    seoOgImageWidth: item.seo?.ogImage?.width ?? null,
    seoOgImageHeight: item.seo?.ogImage?.height ?? null,
    seoOgImageMimeType: item.seo?.ogImage?.mimeType || '',
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

export function toPayload(form, { isCreate = false } = {}) {
  // sortOrder is intentionally omitted: category ordering is owned solely by the
  // drag-reorder on CategoryListScreen. The backend update preserves the existing
  // sortOrder when the field is absent (presence-flag: AdminCatalogMutationService
  // only sets it when non-null), so the detail form never clobbers the list order.
  const payload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    // Luôn gửi mô tả + khối giới thiệu đầu trang, kể cả khi rỗng: backend dùng presence-flag
    // (thiếu khóa = giữ nguyên giá trị cũ, chuỗi rỗng = xóa). Bỏ khóa khi rỗng khiến admin
    // không thể xóa nội dung cũ, trong khi bản tiếng Anh vẫn gửi null nên xóa được — hai bên
    // phải nhất quán. Cùng lỗi đã vá cho Thương hiệu ngày 2026-07-28.
    description: form.description.trim(),
    introContent: form.introContent.trim(),
    parentId: form.parentId.trim(),
  }

  // Visibility is intentionally owned by the list actions. Homepage placement
  // is independent; omit the untouched false default on create so backend
  // defaulting remains the single source of truth.
  if (!isCreate || form.showOnHomepage) payload.showOnHomepage = Boolean(form.showOnHomepage)

  const imageUrl = form.imageUrl.trim()
  payload.image = imageUrl
    ? {
        url: imageUrl,
        alt: String(form.imageAlt ?? '').trim() || null,
        width: Number.isFinite(form.imageWidth) ? form.imageWidth : null,
        height: Number.isFinite(form.imageHeight) ? form.imageHeight : null,
        mimeType: form.imageMimeType?.trim() || null,
      }
    : { url: null }

  const bannerImageUrl = form.bannerImageUrl.trim()
  payload.banner = bannerImageUrl ? { url: bannerImageUrl, alt: String(form.bannerImageAlt ?? '').trim() || null } : { url: null }

  const mobileBannerImageUrl = form.mobileBannerImageUrl.trim()
  payload.mobileBanner = mobileBannerImageUrl
    ? { url: mobileBannerImageUrl, alt: String(form.mobileBannerImageAlt ?? '').trim() || null }
    : { url: null }

  // Ảnh minh hoạ hero (WP ACF "image_left") → backend field `icon` (icon_url). Đây là ảnh
  // web hiển thị ở hero trang danh mục; KHÁC `image` (thumbnail lưới) và `menuIcon` (icon menu).
  const heroImageUrl = form.heroImageUrl.trim()
  payload.icon = heroImageUrl
    ? {
        url: heroImageUrl,
        alt: String(form.heroImageAlt ?? '').trim() || null,
        width: Number.isFinite(form.heroImageWidth) ? form.heroImageWidth : null,
        height: Number.isFinite(form.heroImageHeight) ? form.heroImageHeight : null,
        mimeType: form.heroImageMimeType?.trim() || null,
      }
    : { url: null }

  // Icon line đơn sắc cho menu header + bộ lọc danh mục (lưu vào menu_icon_url).
  const menuIconUrl = form.menuIconUrl.trim()
  payload.menuIcon = menuIconUrl ? { url: menuIconUrl } : { url: null }

  const seoTitle = form.seoTitle.trim()
  const seoDescription = form.seoDescription.trim()
  const seoOgImageUrl = form.seoOgImageUrl.trim()
  payload.seo = {
    title: seoTitle || null,
    description: seoDescription || null,
    // SEO_RULE_003: canonical tự sinh từ slug ở tầng web — không gửi từ form nữa.
    noIndex: Boolean(form.seoNoIndex),
    noIndexEn: Boolean(form.seoNoIndexEn),
    ogImage: seoOgImageUrl
      ? {
          url: seoOgImageUrl,
          alt: String(form.seoOgImageAlt ?? '').trim() || null,
          width: Number.isFinite(form.seoOgImageWidth) ? form.seoOgImageWidth : null,
          height: Number.isFinite(form.seoOgImageHeight) ? form.seoOgImageHeight : null,
          mimeType: form.seoOgImageMimeType?.trim() || null,
        }
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
