// Constants and pure form/helpers for CategoryDetailScreen.
// Extracted from CategoryDetailScreen.jsx to keep the screen file focused on behaviour.

export const STOREFRONT_BASE = `${import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn'}/danh-muc-san-pham`
export const MENU_NOTICE_DISMISSED_KEY = 'bigbike-admin-cat-menu-notice-dismissed'

export function countDescendants(rootId, allCategories) {
  let count = 0
  const queue = [rootId]
  while (queue.length > 0) {
    const parentId = queue.shift()
    const children = allCategories.filter((c) => c.parentId === parentId)
    count += children.length
    children.forEach((c) => queue.push(c.id))
  }
  return count
}

export function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

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
  payload.image = imageUrl ? { url: imageUrl, alt: form.name.trim() || undefined } : { url: null }

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
      ? { url: seoOgImageUrl, alt: form.seoOgImageAlt.trim() || undefined }
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
