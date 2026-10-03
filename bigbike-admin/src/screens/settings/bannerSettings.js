import { resolveDisplayUrl } from '@/lib/contracts'

export const BANNER_PAGES = [
  { prefix: 'hero_products', titleKey: 'banners.pageProducts' },
  { prefix: 'hero_brands', titleKey: 'banners.pageBrands' },
  { prefix: 'hero_news', titleKey: 'banners.pageNews' },
]
export const BANNER_DEFAULT_KEYS = ['hero_default_bg_url', 'hero_default_illustration_url']
export const EDITABLE_BANNER_KEYS = new Set([
  ...BANNER_PAGES.flatMap(({ prefix }) =>
    ['image_url', 'illustration_url', 'image_alt', 'title'].map((suffix) => `${prefix}_${suffix}`),
  ),
  ...BANNER_DEFAULT_KEYS,
])

export const HERO_SYSTEM_BG = '/brand/page-title-bg.png'
export const HERO_SYSTEM_ILLUSTRATION = '/brand/page-title-illustration.png'
const THEME_ROOT = '/wp-content/themes/bigbike/images/'
const STOREFRONT_BASE = (import.meta.env.VITE_STOREFRONT_BASE_URL || 'https://bigbike.vn').replace(
  /\/$/,
  '',
)

// Display only: never send this normalized URL back as the setting's value.
export function resolveBannerPreviewUrl(value) {
  let url = (value || '').trim()
  if (!url) return ''
  const pathname = url.split(/[?#]/, 1)[0]
  if (pathname.endsWith(`${THEME_ROOT}mu-bao-hiem.png`)) url = '/brand/catalog/mu-bao-hiem.png'
  else if (pathname.endsWith(`${THEME_ROOT}page-title-bg.png`)) url = HERO_SYSTEM_BG
  else if (url.startsWith('https://cdn.bigbike.vn/uploads/')) {
    url = '/wp-content/uploads/' + url.slice('https://cdn.bigbike.vn/uploads/'.length)
  } else if (/^https?:\/\/(?:www\.)?bigbike\.vn\/wp-content\//.test(url)) {
    const parsed = new URL(url)
    url = parsed.pathname + parsed.search + parsed.hash
  }
  if (url.startsWith('/brand/') || url.startsWith('/wp-content/')) return STOREFRONT_BASE + url
  return resolveDisplayUrl(url)
}

export function bannerImageSource(own, globalDefault, systemAsset) {
  const value = own?.trim() || globalDefault?.trim() || systemAsset
  return {
    src: resolveBannerPreviewUrl(value),
    source: own?.trim() ? 'own' : globalDefault?.trim() ? 'default' : 'fallback',
  }
}

export function bannerPreviewTitle(vi, en, contentLang, fallback) {
  return (contentLang === 'en' ? en?.trim() : '') || vi?.trim() || fallback
}

export function heroPreviewGeometry(viewportWidth, panelWidth) {
  const desktop = viewportWidth >= 768
  const sourceHeight = desktop ? 450 : 250
  const scale = panelWidth / viewportWidth
  const railWidth = desktop
    ? Math.min(viewportWidth - (viewportWidth >= 992 ? 64 : 48), 1200)
    : viewportWidth
  return { desktop, sourceHeight, scale, height: sourceHeight * scale, railWidth }
}
