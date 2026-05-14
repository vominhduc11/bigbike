import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createProduct,
  fetchBrands,
  fetchCategoryTree,
  fetchProductDetail,
  mapValidationErrors,
  updateProduct,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime } from '../lib/formatters'
import { createProductSchema, zodErrors } from '../lib/schemas'
import { StatePanel } from '../components/StatePanel'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { MediaPickerModal } from '../components/MediaPickerModal'
import { VideoPickerModal } from '../components/VideoPickerModal'
import { RichTextEditor } from '../components/RichTextEditor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'

// Matches YouTube IDs across watch, share, embed, and shorts URLs.
function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

function inferVideoType(url, provider) {
  if (provider === 'youtube' || provider === 'upload') return provider
  if (extractYouTubeId(url)) return 'youtube'
  return url ? 'upload' : 'youtube'
}

// ── Collapsible section ────────────────────────────────────────────────────────

function CollapsibleSection({ id, title, description, children }) {
  const storageKey = `product-section-open:${id}`
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored === null ? true : stored !== 'false'
    } catch { return true }
  })

  function toggle() {
    setOpen((prev) => {
      const next = !prev
      try { localStorage.setItem(storageKey, String(next)) } catch { /* ignore quota errors */ }
      return next
    })
  }

  return (
    <section id={id} className={`detail-section${open ? '' : ' is-collapsed'}`}>
      <header className="detail-section-header detail-section-header--toggle" onClick={toggle}>
        <div>
          <h2>{title}</h2>
          {description ? <p className="detail-section-desc">{description}</p> : null}
        </div>
        <span className="section-collapse-icon" aria-hidden="true">
          {open ? <IconChevronUp /> : <IconChevronDown />}
        </span>
      </header>
      <div className="detail-section-collapse-wrap">
        <div className="detail-section-collapse-inner">
          {children}
        </div>
      </div>
    </section>
  )
}

// ── Section navigation ─────────────────────────────────────────────────────────

const SECTION_ITEMS = [
  { id: 'section-basic', label: 'Cơ bản' },
  { id: 'section-pricing', label: 'Giá' },
  { id: 'section-media', label: 'Ảnh' },
  { id: 'section-seo', label: 'SEO' },
  { id: 'section-content-bottom', label: 'Nội dung SEO' },
  { id: 'section-gallery', label: 'Gallery' },
  { id: 'section-videos', label: 'Video' },
  { id: 'section-specs', label: 'Thông số' },
  { id: 'section-variants', label: 'Biến thể' },
]

function SectionNav() {
  const [active, setActive] = useState(SECTION_ITEMS[0].id)

  useEffect(() => {
    const scrollEl = document.querySelector('.page-content')
    if (!scrollEl) return

    let rafId = null

    function update() {
      rafId = null
      const containerTop = scrollEl.getBoundingClientRect().top
      let current = SECTION_ITEMS[0].id
      for (const { id } of SECTION_ITEMS) {
        const el = document.getElementById(id)
        if (!el) continue
        const top = el.getBoundingClientRect().top - containerTop
        if (top <= 64) current = id
      }
      setActive(current)
    }

    function onScroll() {
      if (rafId) return
      rafId = requestAnimationFrame(update)
    }

    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      scrollEl.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="section-nav" aria-label="Điều hướng">
      {SECTION_ITEMS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`section-nav-pill${active === id ? ' is-active' : ''}`}
          onClick={() => scrollToSection(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}

// ── Slug generation ────────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
}

// Returns the set of statuses the dropdown should allow given the saved status.
// Mirrors AdminMutationValidators.validatePublishTransition on the backend.
function getAllowedPublishStatuses(from) {
  const RULES = {
    DRAFT:     ['DRAFT', 'PUBLISHED', 'HIDDEN'],
    PUBLISHED: ['PUBLISHED', 'HIDDEN'],
    HIDDEN:    ['HIDDEN', 'PUBLISHED', 'DRAFT'],
    TRASH:     ['TRASH', 'DRAFT'],
    // Legacy escape paths for any remaining DB records before migration
    ARCHIVED:  ['HIDDEN', 'DRAFT'],
    PENDING:   ['PUBLISHED', 'DRAFT'],
    PRIVATE:   ['PUBLISHED', 'DRAFT', 'HIDDEN'],
  }
  return RULES[from] ?? ['DRAFT', 'PUBLISHED', 'HIDDEN']
}

// Format a raw digit string as Vietnamese price (e.g. "6300000" → "6.300.000").
function formatPrice(raw) {
  if (!raw) return ''
  return String(raw).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// ── Autosave utilities ─────────────────────────────────────────────────────────

const AUTOSAVE_TTL_MS = 60 * 60 * 1000

function getAutosaveKey(productId, isCreate) {
  return `product-autosave:${isCreate ? 'new' : productId}`
}

function saveFormToStorage(key, form) {
  try {
    localStorage.setItem(key, JSON.stringify({ form, ts: Date.now() }))
  } catch { /* quota */ }
}

function loadFormFromStorage(key) {
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

function clearFormFromStorage(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// ── Publish readiness checklist ────────────────────────────────────────────────

function getPublishReadiness(form) {
  // Detect color groups that have a main image but no gallery.
  // On the storefront these colors show a single hero with no thumbnail strip.
  const colorKeys = [...new Set(form.variants.map(getVariantColorKey).filter(Boolean))]
  const colorsImageOnly = colorKeys.filter((colorKey) => {
    const peers = form.variants.filter((v) => getVariantColorKey(v) === colorKey)
    const hasImage = peers.some((v) => String(v.imageUrl || '').trim())
    const hasGallery = peers.some((v) => hasGalleryImages(v.gallery))
    return hasImage && !hasGallery
  })
  const colorsImageOnlyLabels = colorsImageOnly.map((colorKey) => {
    const v = form.variants.find((v) => getVariantColorKey(v) === colorKey)
    return getVariantColorValue(v) || colorKey
  })

  const items = [
    { id: 'name',      label: 'Tên sản phẩm',           ok: Boolean(form.name.trim()),                             required: true },
    { id: 'image',     label: 'Ảnh đại diện',            ok: Boolean(form.imageUrl.trim()),                         required: false },
    { id: 'price',     label: 'Giá bán',                 ok: Boolean(form.retailPrice?.trim()),                     required: true },
    { id: 'shortDesc', label: 'Mô tả ngắn (≥20 ký tự)', ok: form.shortDescription.trim().length >= 20,             required: false },
    { id: 'desc',      label: 'Mô tả chi tiết',          ok: form.description.trim().length > 50,                   required: false },
  ]

  if (colorsImageOnly.length > 0) {
    items.push({
      id: 'variantGallery',
      label: `Màu chỉ có ảnh chính, chưa có gallery: ${colorsImageOnlyLabels.join(', ')} — storefront chỉ hiện 1 ảnh, không có thumbnail strip`,
      ok: false,
      required: false,
    })
  }

  return items
}

// ── Empty form builders ────────────────────────────────────────────────────────

const COLOR_ATTRIBUTE_KEYS = new Set([
  'color',
  'colour',
  'mau',
  'mau sac',
  'pa color',
  'pa mau',
  'pa mau sac',
])

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

function getVariantColorValue(variant) {
  return (variant.options || []).find((option) => isColorAttributeName(option.name))?.value?.trim() || ''
}

function getVariantColorKey(variant) {
  const value = getVariantColorValue(variant)
  return value ? normalizeVariantToken(value) : ''
}

function cloneGallery(gallery = []) {
  return gallery.map((img) => ({ ...img }))
}

function hasGalleryImages(gallery = []) {
  return gallery.some((img) => String(img.url || '').trim())
}

function withColorScopedMedia(variants = []) {
  const galleryByColor = new Map()
  const imageByColor = new Map()

  variants.forEach((variant) => {
    const colorKey = getVariantColorKey(variant)
    if (!colorKey) return
    if (hasGalleryImages(variant.gallery) && !galleryByColor.has(colorKey)) {
      galleryByColor.set(colorKey, cloneGallery(variant.gallery))
    }
    if (String(variant.imageUrl || '').trim() && !imageByColor.has(colorKey)) {
      imageByColor.set(colorKey, variant.imageUrl.trim())
    }
  })

  return variants.map((variant) => {
    const colorKey = getVariantColorKey(variant)
    const gallery = colorKey ? galleryByColor.get(colorKey) || [] : []
    const imageUrl = colorKey ? imageByColor.get(colorKey) || '' : ''
    return { ...variant, gallery: cloneGallery(gallery), imageUrl }
  })
}

function buildEmptyForm() {
  return {
    sku: '',
    slug: '',
    name: '',
    shortDescription: '',
    description: '',
    contentBottom: '',
    brandId: '',
    categoryId: '',
    retailPrice: '',
    compareAtPrice: '',
    salePrice: '',
    stockState: 'IN_STOCK',
    forceOutOfStock: false,
    publishStatus: 'DRAFT',
    imageUrl: '',
    imageAlt: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    seoNoIndex: false,
    isFeatured: false,
    showOnHomepage: false,
    homepageOrder: '',
    gallery: [],
    videos: [],
    specifications: [],
    variants: [],
  }
}

function buildFormFromItem(item) {
  if (!item) return buildEmptyForm()

  const variants = withColorScopedMedia((item.variants || []).map((v) => ({
    _key: v.id || crypto.randomUUID(),
    id: v.id || '',
    sku: v.sku || '',
    name: v.name || '',
    stockState: v.stockState === 'UNKNOWN' ? 'IN_STOCK' : (v.stockState || 'IN_STOCK'),
    imageUrl: v.image?.url || '',
    isAvailable: v.isAvailable !== false,
    options: (v.options || []).map((o) => ({ name: o.name || '', value: o.value || '' })),
    gallery: (v.gallery || []).map((img) => ({ url: img.url || '' })),
  })))

  return {
    sku: item.sku || '',
    slug: item.slug || '',
    name: item.name || '',
    shortDescription: item.shortDescription || '',
    description: item.description || '',
    contentBottom: item.contentBottom || '',
    brandId: item.brand?.id || '',
    categoryId: item.category?.id || '',
    retailPrice:
      Number.isInteger(item.price?.retailPrice) && item.price.retailPrice > 0
        ? String(item.price.retailPrice)
        : '',
    compareAtPrice:
      Number.isInteger(item.price?.compareAtPrice) && item.price.compareAtPrice > 0
        ? String(item.price.compareAtPrice)
        : '',
    salePrice:
      Number.isInteger(item.price?.salePrice) && item.price.salePrice > 0
        ? String(item.price.salePrice)
        : '',
    stockState: item.stockState === 'UNKNOWN' ? 'IN_STOCK' : item.stockState,
    forceOutOfStock: Boolean(item.forceOutOfStock),
    publishStatus: item.publishStatus,
    imageUrl: item.image?.url || '',
    imageAlt: item.image?.alt || '',
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoOgImageUrl: item.seo?.ogImage?.url || '',
    seoOgImageAlt: item.seo?.ogImage?.alt || '',
    seoNoIndex: Boolean(item.seo?.noIndex),
    isFeatured: Boolean(item.isFeatured),
    showOnHomepage: Boolean(item.showOnHomepage),
    homepageOrder: Number.isFinite(item.homepageOrder) ? String(item.homepageOrder) : '',
    gallery: (item.gallery || []).map((img) => ({ url: img.url || '', alt: img.alt || '' })),
    videos: (item.videos || []).map((v) => ({
      url: v.url || '',
      title: v.title || '',
      type: inferVideoType(v.url || '', v.provider),
      thumbnailUrl: v.thumbnail?.url || '',
    })),
    specifications: (item.specifications || []).map((s) => ({
      _key: crypto.randomUUID(),
      name: s.name || '',
      value: s.value || '',
      groupName: s.group || '',
    })),
    variants,
  }
}

// Like toIntegerOrUndefined but sends null for empty so the backend can
// distinguish "user cleared this field" from "field not sent at all".
function toIntegerOrNull(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) return Number.NaN
  return parsed
}

function toPayload(form) {
  const hasSeo =
    form.seoTitle.trim() ||
    form.seoDescription.trim() ||
    form.seoCanonicalUrl.trim() ||
    form.seoOgImageUrl.trim() ||
    form.seoOgImageAlt.trim() ||
    form.seoNoIndex

  const payload = {
    sku: form.sku.trim() || null,
    slug: form.slug.trim(),
    name: form.name.trim(),
    shortDescription: form.shortDescription.trim() || undefined,
    description: form.description.trim() || undefined,
    contentBottom: form.contentBottom.trim() ? form.contentBottom.trim() : null,
    brandId: form.brandId.trim() || undefined,
    categoryId: form.categoryId.trim(),
    // Send null when cleared so backend (presence-flag logic) can distinguish
    // "user erased this" from "field not part of this request".
    retailPrice: toIntegerOrNull(form.retailPrice),
    compareAtPrice: toIntegerOrNull(form.compareAtPrice),
    salePrice: toIntegerOrNull(form.salePrice),
    currency: 'VND',
    stockState: form.stockState,
    forceOutOfStock: Boolean(form.forceOutOfStock),
    publishStatus: form.publishStatus,
    featured: Boolean(form.isFeatured),
    showOnHomepage: Boolean(form.showOnHomepage),
    homepageOrder: form.homepageOrder === '' ? null : toIntegerOrNull(form.homepageOrder),
    seo: hasSeo
      ? {
          title: form.seoTitle.trim() || null,
          description: form.seoDescription.trim() || null,
          canonicalUrl: form.seoCanonicalUrl.trim() || null,
          ogImage: form.seoOgImageUrl.trim()
            ? { url: form.seoOgImageUrl.trim(), alt: form.seoOgImageAlt.trim() || undefined }
            : null,
          noIndex: Boolean(form.seoNoIndex),
        }
      : null,
    // Always include image — null signals "clear the primary image".
    image: form.imageUrl.trim()
      ? { url: form.imageUrl.trim(), alt: form.imageAlt.trim() || undefined }
      : null,
  }

  payload.gallery = form.gallery
    .filter((img) => img.url.trim())
    .map((img, i) => ({ url: img.url.trim(), alt: img.alt?.trim() || undefined, sortOrder: i }))

  payload.videos = form.videos
    .filter((v) => v.url.trim())
    .map((v, i) => ({
      url: v.url.trim(),
      title: v.title.trim() || undefined,
      provider: v.type === 'upload' ? 'upload' : 'youtube',
      thumbnailUrl: v.type === 'upload' ? (v.thumbnailUrl?.trim() || undefined) : undefined,
      sortOrder: i,
    }))

  payload.specifications = form.specifications
    .filter((s) => s.name.trim() && s.value.trim())
    .map((s, i) => ({
      name: s.name.trim(),
      value: s.value.trim(),
      groupName: s.groupName.trim() || undefined,
      sortOrder: i,
    }))

  const scopedVariants = withColorScopedMedia(form.variants).filter((v) => v.name.trim())
  const emittedImageColors = new Set()
  const emittedGalleryColors = new Set()

  payload.variants = scopedVariants.map((v, i) => {
    const colorKey = getVariantColorKey(v)
    const imageUrl = String(v.imageUrl || '').trim()
    const gallery = (v.gallery ?? [])
      .filter((img) => img.url.trim())
      .map((img, j) => ({ url: img.url.trim(), sortOrder: j }))

    const shouldSendImage = Boolean(colorKey && imageUrl && !emittedImageColors.has(colorKey))
    const shouldSendGallery = Boolean(colorKey && gallery.length > 0 && !emittedGalleryColors.has(colorKey))
    if (shouldSendImage) emittedImageColors.add(colorKey)
    if (shouldSendGallery) emittedGalleryColors.add(colorKey)

    return {
      id: v.id || undefined,
      sku: v.sku.trim() || undefined,
      name: v.name.trim(),
      // Variant price fields intentionally omitted — see ProductDetailScreen
      // variant form section. Cart/checkout always use product price.
      stockState: v.stockState,
      imageUrl: shouldSendImage ? imageUrl : undefined,
      isAvailable: Boolean(v.isAvailable),
      sortOrder: i,
      options: v.options
        .filter((o) => o.name.trim() && o.value.trim())
        .map((o, j) => ({ optionName: o.name.trim(), optionValue: o.value.trim(), sortOrder: j })),
      gallery: shouldSendGallery ? gallery : [],
    }
  })

  return payload
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function IconChevronUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

function GalleryCard({ item, onUpdate, onRemove, disabled, urlError }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const trimmed = item.url.trim()
  const thumbState = trimmed ? 'ok' : 'empty'

  return (
    <div className={`gallery-card${urlError ? ' gallery-card--error' : ''}`}>
      <div
        className="gallery-card-thumb"
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setPickerOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && setPickerOpen(true)}
        aria-label="Chọn ảnh"
      >
        {thumbState === 'ok' && <img src={trimmed} alt="" loading="eager" />}
        {thumbState === 'loading' && <span className="gallery-thumb-status">⋯</span>}
        {thumbState === 'error' && <span className="gallery-thumb-status gallery-thumb-error">!</span>}
        {thumbState === 'empty' && <span className="gallery-thumb-status">🖼</span>}
        {!disabled && (
          <button
            type="button"
            className="gallery-card-remove"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            aria-label="Xóa ảnh"
          >
            ✕
          </button>
        )}
      </div>
      <div className="gallery-card-body">
        <button
          type="button"
          className="btn btn-secondary btn-sm gallery-card-pick-btn"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
        >
          {trimmed ? 'Đổi ảnh' : 'Chọn ảnh'}
        </button>
        <input
          type="text"
          className="gallery-card-alt-input"
          placeholder="Alt text (mô tả ảnh)"
          value={item.alt || ''}
          onChange={(e) => onUpdate('alt', e.target.value)}
          disabled={disabled}
          aria-label="Mô tả ảnh (alt text)"
        />
        {urlError && <small className="field-error">{urlError}</small>}
      </div>
      {pickerOpen && (
        <MediaPickerModal
          onSelect={(url) => { onUpdate('url', url); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

function GalleryEditor({ items, onChange, disabled, validationErrors = {} }) {
  const [multiPickerOpen, setMultiPickerOpen] = useState(false)

  function updateItem(index, field, value) {
    onChange(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function addItem() {
    onChange([...items, { url: '', alt: '' }])
  }

  return (
    <div className="gallery-editor">
      <div className="gallery-grid">
        {items.map((item, index) => (
          <GalleryCard
            key={index}
            item={item}
            onUpdate={(field, value) => updateItem(index, field, value)}
            onRemove={() => removeItem(index)}
            disabled={disabled}
            urlError={validationErrors[`gallery.${index}.url`]}
          />
        ))}
        {!disabled && (
          <button type="button" className="gallery-card-add" onClick={addItem}>
            <span className="gallery-add-icon">+</span>
            <span>Thêm ảnh</span>
          </button>
        )}
      </div>
      {!disabled && (
        <button
          type="button"
          className="btn btn-secondary btn-sm gallery-multi-pick-btn"
          onClick={() => setMultiPickerOpen(true)}
          title="Chọn nhiều ảnh cùng lúc từ thư viện"
        >
          + Chọn nhiều ảnh
        </button>
      )}
      {multiPickerOpen && (
        <MediaPickerModal
          multiSelect
          onSelectMultiple={(urls) => {
            onChange([
              ...items,
              ...urls.map((url) => ({ url, alt: '' })),
            ])
            setMultiPickerOpen(false)
          }}
          onClose={() => setMultiPickerOpen(false)}
        />
      )}
    </div>
  )
}

function VideoEditor({ items, onChange, disabled, validationErrors = {} }) {
  const [pickerOpenIndex, setPickerOpenIndex] = useState(null)

  function updateItem(index, patch) {
    onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item))
  }
  function addItem() {
    onChange([...items, { url: '', title: '', type: 'youtube', thumbnailUrl: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="list-editor">
      {items.map((item, index) => {
        const type = item.type || 'youtube'
        const urlError = validationErrors[`videos.${index}.url`]
        const ytId = type === 'youtube' ? extractYouTubeId(item.url) : null
        return (
          <div key={index} className="list-editor-row">
            <div className="list-editor-fields">
              <div className="video-source-toggle" style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={`video-type-${index}`}
                    value="youtube"
                    checked={type === 'youtube'}
                    onChange={() => updateItem(index, { type: 'youtube', url: '' })}
                    disabled={disabled}
                  />
                  YouTube
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={`video-type-${index}`}
                    value="upload"
                    checked={type === 'upload'}
                    onChange={() => updateItem(index, { type: 'upload', url: '' })}
                    disabled={disabled}
                  />
                  Từ thư viện
                </label>
              </div>

              {type === 'youtube' ? (
                <div>
                  <Input className={urlError  ? 'border-danger' : undefined}
                    placeholder="URL video YouTube (https://...)"
                    value={item.url}
                    onChange={(e) => updateItem(index, { url: e.target.value })}
                    disabled={disabled}
                   />
                  {urlError && <small className="field-error">{urlError}</small>}
                  {ytId && (
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                      alt="YouTube thumbnail preview"
                      style={{ marginTop: 8, width: '100%', maxWidth: 240, height: 'auto', borderRadius: 4, border: '1px solid var(--admin-color-border-subtle)' }}
                    />
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm${urlError ? ' input-error' : ''}`}
                      onClick={() => setPickerOpenIndex(index)}
                      disabled={disabled}
                    >
                      {item.url ? 'Đổi video' : 'Chọn từ thư viện'}
                    </button>
                    {item.url && (
                      <button
                        type="button"
                        className="btn btn-icon btn-danger-ghost"
                        onClick={() => updateItem(index, { url: '' })}
                        disabled={disabled}
                        aria-label="Xoá video đã chọn"
                      >
                        ✕
                      </button>
                    )}
                    {item.url && (
                      <span style={{ fontSize: 12, color: 'var(--admin-color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                        ✓ {item.url.split('/').pop()}
                      </span>
                    )}
                  </div>
                  {urlError && <small className="field-error">{urlError}</small>}
                  {item.url && (
                    <video
                      src={`${item.url}#t=0.001`}
                      controls
                      preload="metadata"
                      style={{ marginTop: 8, width: '100%', maxWidth: 320, height: 'auto', borderRadius: 4, border: '1px solid var(--admin-color-border-subtle)' }}
                    />
                  )}
                  <Input
                    placeholder="Thumbnail URL (tuỳ chọn)"
                    value={item.thumbnailUrl || ''}
                    onChange={(e) => updateItem(index, { thumbnailUrl: e.target.value })}
                    disabled={disabled}
                   />
                </div>
              )}

              <Input
                placeholder="Tiêu đề video"
                value={item.title}
                onChange={(e) => updateItem(index, { title: e.target.value })}
                disabled={disabled}
               />
            </div>
            <button
              type="button"
              className="btn btn-icon btn-danger-ghost"
              onClick={() => removeItem(index)}
              disabled={disabled}
              aria-label="Xóa video"
            >
              ✕
            </button>
          </div>
        )
      })}
      <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} disabled={disabled}>
        + Thêm video
      </button>
      {pickerOpenIndex !== null && (
        <VideoPickerModal
          onSelect={(url) => {
            updateItem(pickerOpenIndex, { url, type: 'upload' })
            setPickerOpenIndex(null)
          }}
          onClose={() => setPickerOpenIndex(null)}
        />
      )}
    </div>
  )
}

function SpecificationsEditor({ items, onChange, disabled, validationErrors }) {
  function updateItem(index, field, value) {
    const next = items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    onChange(next)
  }
  function addItem() {
    onChange([...items, { _key: crypto.randomUUID(), name: '', value: '', groupName: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function moveItem(index, dir) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">Chưa có thông số. Nhấn "+ Thêm thông số" để bắt đầu.</p>
      )}
      {items.map((item, index) => {
        const errName = validationErrors?.[`specifications.${index}.name`]
        const errValue = validationErrors?.[`specifications.${index}.value`]
        const errGroup = validationErrors?.[`specifications.${index}.groupName`]
        return (
          <div key={item._key} className="list-editor-row list-editor-row--stack">
            <div className="list-editor-reorder">
              <button type="button" className="btn btn-icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label="Lên">▲</button>
              <button type="button" className="btn btn-icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label="Xuống">▼</button>
            </div>
            <div className="list-editor-fields list-editor-fields-3col" style={{ flex: 1 }}>
              <div>
                <Input className={errGroup  ? 'border-danger' : undefined}
                  placeholder="Nhóm (vd: Vật liệu, Kích thước)"
                  title="Tên nhóm gộp nhiều thông số lại"
                  value={item.groupName}
                  onChange={(e) => updateItem(index, 'groupName', e.target.value)}
                  disabled={disabled}
                  maxLength={100}
                 />
                {errGroup && <small className="field-error">{errGroup}</small>}
              </div>
              <div>
                <Input className={errName  ? 'border-danger' : undefined}
                  placeholder="Tên thông số *"
                  value={item.name}
                  onChange={(e) => updateItem(index, 'name', e.target.value)}
                  disabled={disabled}
                  maxLength={255}
                 />
                {errName && <small className="field-error">{errName}</small>}
              </div>
              <div>
                <Input className={errValue  ? 'border-danger' : undefined}
                  placeholder="Giá trị *"
                  value={item.value}
                  onChange={(e) => updateItem(index, 'value', e.target.value)}
                  disabled={disabled}
                  maxLength={2000}
                 />
                {errValue && <small className="field-error">{errValue}</small>}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-icon btn-danger-ghost"
              onClick={() => removeItem(index)}
              disabled={disabled}
              aria-label="Xóa thông số"
            >
              ✕
            </button>
          </div>
        )
      })}
      <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} disabled={disabled}>
        + Thêm thông số
      </button>
    </div>
  )
}

function VariantOptionsEditor({ options, onChange, disabled }) {
  function updateOption(i, field, value) {
    const next = options.map((o, idx) => idx === i ? { ...o, [field]: value } : o)
    onChange(next)
  }
  function addOption() {
    onChange([...options, { name: '', value: '' }])
  }
  function removeOption(i) {
    onChange(options.filter((_, idx) => idx !== i))
  }

  return (
    <div className="variant-options-editor">
      {options.map((opt, i) => (
        <div key={i} className="list-editor-row variant-option-row">
          <Input
            placeholder="Thuộc tính (vd: Màu)"
            value={opt.name}
            onChange={(e) => updateOption(i, 'name', e.target.value)}
            disabled={disabled}
           />
          <Input
            placeholder="Giá trị (vd: Đỏ)"
            value={opt.value}
            onChange={(e) => updateOption(i, 'value', e.target.value)}
            disabled={disabled}
           />
          <button
            type="button"
            className="btn btn-icon btn-danger-ghost"
            onClick={() => removeOption(i)}
            disabled={disabled}
            aria-label="Xóa thuộc tính"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={addOption} disabled={disabled}>
        + Thêm thuộc tính
      </button>
    </div>
  )
}

function VariantCard({
  variant,
  index,
  expanded,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
  disabled,
  fieldErrors = {},
}) {
  function updateField(field, value) {
    onChange(variant._key, { [field]: value })
  }

  const label = variant.name.trim() || `Biến thể ${index + 1}`
  const optionSummary = variant.options.filter((o) => o.name && o.value).map((o) => `${o.name}: ${o.value}`).join(', ')
  const hasErrors = Object.keys(fieldErrors).length > 0
  const colorValue = getVariantColorValue(variant)
  const hasColor = Boolean(colorValue)

  return (
    <div className={`variant-card${hasErrors ? ' variant-card--error' : ''}`}>
      <div className="variant-card-header" onClick={() => onToggle(variant._key)}>
        <div className="variant-card-title">
          <span className="variant-card-index">#{index + 1}</span>
          <span>{label}</span>
          {optionSummary && <span className="variant-card-summary">{optionSummary}</span>}
          {hasErrors && <span className="variant-card-error-badge" title="Có lỗi cần sửa">!</span>}
        </div>
        <div className="variant-card-actions">
          <button
            type="button"
            className="btn btn-icon btn-secondary-ghost"
            onClick={(e) => { e.stopPropagation(); onDuplicate(variant._key) }}
            disabled={disabled}
            aria-label="Sao chép biến thể"
            title="Sao chép biến thể"
          >
            ⎘
          </button>
          <button
            type="button"
            className="btn btn-icon btn-danger-ghost"
            onClick={(e) => { e.stopPropagation(); onRemove(variant._key) }}
            disabled={disabled}
            aria-label="Xóa biến thể"
          >
            ✕
          </button>
          <span className="variant-card-toggle">{expanded ? <IconChevronUp /> : <IconChevronDown />}</span>
        </div>
      </div>

      {expanded && (
        <div className="variant-card-body form-grid">
          <label className="form-field">
            <span>Tên biến thể *</span>
            <Input
              value={variant.name}
              onChange={(e) => updateField('name', e.target.value)}
              disabled={disabled}
              placeholder="vd: Size M - Đỏ"
             />
            {fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}
          </label>

          <label className="form-field">
            <span>SKU</span>
            <Input
              value={variant.sku}
              onChange={(e) => updateField('sku', e.target.value)}
              disabled={disabled}
             />
          </label>

          {/* Variant price inputs removed: storefront, cart, and checkout use
              the parent product price regardless of variant, so collecting
              per-variant prices here would silently diverge from what the
              customer sees and pays. */}

          <label className="form-field">
            <span>Trạng thái kho</span>
            <Select
              value={variant.stockState}
              onValueChange={(val) => updateField('stockState', val)}
              disabled={disabled}
            ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="IN_STOCK">Còn hàng</SelectItem>
              <SelectItem value="LOW_STOCK">Còn ít</SelectItem>
              <SelectItem value="OUT_OF_STOCK">Hết hàng</SelectItem>
            </SelectContent></Select>
          </label>

          <div className="form-field form-field-wide">
            <span className="form-field-label">
              {hasColor ? `Ảnh chính theo màu: ${colorValue}` : 'Ảnh chính theo màu'}
            </span>
            <p className="detail-section-desc" style={{ marginTop: 0, marginBottom: 8 }}>
              {hasColor
                ? 'Ảnh này dùng chung cho mọi size/biến thể có cùng màu. Đổi size trong cùng màu sẽ không đổi ảnh chính.'
                : 'Thêm thuộc tính Màu/Color cho biến thể để cấu hình ảnh chính theo màu.'}
            </p>
            {hasColor && (
              <>
                <ImageUrlInput
                  value={variant.imageUrl}
                  onChange={(url) => updateField('imageUrl', url)}
                  disabled={disabled}
                  error={fieldErrors.imageUrl}
                />
                {fieldErrors.imageUrl && <small className="field-error">{fieldErrors.imageUrl}</small>}
              </>
            )}
          </div>

          <label className="form-checkbox form-field-wide">
            <Checkbox
              checked={variant.isAvailable}
              onCheckedChange={(checked) => updateField('isAvailable', checked)}
              disabled={disabled}
             />
            <span>Kích hoạt bán</span>
          </label>

          <div className="form-field form-field-wide">
            <span className="form-field-label">Thuộc tính biến thể</span>
            <VariantOptionsEditor
              options={variant.options}
              onChange={(opts) => updateField('options', opts)}
              disabled={disabled}
            />
          </div>

          <div className="form-field form-field-wide">
            <span className="form-field-label">
              {hasColor ? `Gallery theo màu: ${colorValue}` : 'Gallery theo màu'}
            </span>
            <p className="detail-section-desc" style={{ marginTop: 0, marginBottom: 8 }}>
              {hasColor
                ? 'Gallery này dùng chung cho mọi size/biến thể có cùng màu. Đổi size trong cùng màu sẽ không đổi danh sách ảnh.'
                : 'Thêm thuộc tính Màu/Color cho biến thể để cấu hình gallery theo màu. Biến thể không có màu sẽ dùng gallery chung của sản phẩm.'}
            </p>
            {fieldErrors.gallery && <small className="field-error">{fieldErrors.gallery}</small>}
            {hasColor && (
              <GalleryEditor
                items={variant.gallery ?? []}
                onChange={(next) => updateField('gallery', next)}
                disabled={disabled}
                validationErrors={fieldErrors}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Threshold above which a filter input is shown. With < 6 variants the
// filter would just take vertical space without helping users locate.
const VARIANTS_FILTER_THRESHOLD = 6

function VariantsEditor({ items, onChange, disabled, validationErrors = {}, onOpenMatrixWizard }) {
  // Single-open accordion: only one card body is expanded at a time. With
  // 50–500 biến thể, having all open at once produces unmanageable scroll.
  const [expandedKey, setExpandedKey] = useState(() => items[0]?._key ?? null)
  const [filter, setFilter] = useState('')

  // ── Auto-expand the card whose validation key surfaces ───────────────
  // Adjusts state during render (not in an Effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // Without this, submit on a card that's collapsed would silently fail to
  // focus the offending input — the input doesn't exist in the DOM yet.
  const errKey = Object.keys(validationErrors).find((k) => k.startsWith('variants.'))
  const [seenErrKey, setSeenErrKey] = useState(errKey)
  if (errKey !== seenErrKey) {
    setSeenErrKey(errKey)
    if (errKey) {
      const m = errKey.match(/^variants\.(\d+)\./)
      if (m) {
        const offending = items[Number(m[1])]
        if (offending?._key) setExpandedKey(offending._key)
      }
    }
  }

  function toggleExpanded(key) {
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  function updateVariant(key, partial) {
    const current = items.find((v) => v._key === key)
    if (!current) return

    const nextCurrent = { ...current, ...partial }

    if (Object.prototype.hasOwnProperty.call(partial, 'imageUrl')) {
      const colorKey = getVariantColorKey(nextCurrent)
      const imageUrl = colorKey ? (partial.imageUrl ?? '') : ''
      onChange(items.map((v) => (
        v._key === key || (colorKey && getVariantColorKey(v) === colorKey)
          ? { ...v, ...(v._key === key ? partial : {}), imageUrl }
          : v
      )))
      return
    }

    if (Object.prototype.hasOwnProperty.call(partial, 'gallery')) {
      const colorKey = getVariantColorKey(nextCurrent)
      const gallery = colorKey ? cloneGallery(partial.gallery) : []
      onChange(items.map((v) => (
        v._key === key || (colorKey && getVariantColorKey(v) === colorKey)
          ? { ...v, ...(v._key === key ? partial : {}), gallery: cloneGallery(gallery) }
          : v
      )))
      return
    }

    if (Object.prototype.hasOwnProperty.call(partial, 'options')) {
      const previousColorKey = getVariantColorKey(current)
      const nextColorKey = getVariantColorKey(nextCurrent)
      if (previousColorKey !== nextColorKey) {
        const existingColorGallery = nextColorKey
          ? items.find((v) => v._key !== key && getVariantColorKey(v) === nextColorKey && hasGalleryImages(v.gallery))?.gallery
          : []
        const existingColorImage = nextColorKey
          ? (items.find((v) => v._key !== key && getVariantColorKey(v) === nextColorKey && String(v.imageUrl || '').trim())?.imageUrl ?? '')
          : ''
        onChange(items.map((v) => (
          v._key === key
            ? { ...nextCurrent, gallery: cloneGallery(existingColorGallery || []), imageUrl: existingColorImage }
            : v
        )))
        return
      }
    }

    onChange(items.map((v) => v._key === key ? nextCurrent : v))
  }

  function buildEmptyVariant() {
    return {
      _key: crypto.randomUUID(),
      id: '',
      sku: '',
      name: '',
      stockState: 'IN_STOCK',
      imageUrl: '',
      isAvailable: true,
      options: [],
      gallery: [],
    }
  }

  function addVariant() {
    const created = buildEmptyVariant()
    onChange([...items, created])
    setExpandedKey(created._key)
  }

  function duplicateVariant(key) {
    const idx = items.findIndex((v) => v._key === key)
    if (idx === -1) return
    const original = items[idx]

    // Generate a non-colliding copy SKU: base-COPY, base-COPY-2, base-COPY-3…
    const existingSkus = new Set(items.map((v) => v.sku).filter(Boolean))
    function makeCopySku(sku) {
      if (!sku) return ''
      const base = sku.replace(/-COPY(?:-\d+)?$/, '')
      const candidate = `${base}-COPY`
      if (!existingSkus.has(candidate)) return candidate
      let n = 2
      while (existingSkus.has(`${candidate}-${n}`)) n++
      return `${candidate}-${n}`
    }

    const copy = {
      ...original,
      _key: crypto.randomUUID(),
      id: '',
      sku: makeCopySku(original.sku),
      name: original.name ? `${original.name} (sao chép)` : '',
      options: original.options.map((o) => ({ ...o })),
      gallery: (original.gallery ?? []).map((img) => ({ ...img })),
    }
    const next = [...items.slice(0, idx + 1), copy, ...items.slice(idx + 1)]
    onChange(next)
    setExpandedKey(copy._key)
  }

  async function removeVariant(key) {
    const idx = items.findIndex((v) => v._key === key)
    if (idx === -1) return
    const variant = items[idx]
    const label = variant.name.trim() || `Biến thể ${idx + 1}`
    const confirmed = await showConfirm(
      `Xoá biến thể "${label}"? Thao tác này không thể hoàn tác.`,
      'Xoá biến thể',
    )
    if (!confirmed) return
    onChange(items.filter((v) => v._key !== key))
    if (expandedKey === key) setExpandedKey(null)
  }

  // ── Filter (rendered only above threshold) ────────────────────────────
  const filterTerm = filter.trim().toLowerCase()
  const visible = filterTerm
    ? items.flatMap((v, originalIdx) => {
        const haystack = [
          v.name,
          v.sku,
          ...v.options.flatMap((o) => [o.name, o.value]),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(filterTerm) ? [{ v, originalIdx }] : []
      })
    : items.map((v, i) => ({ v, originalIdx: i }))

  // Effective expanded key — if the filter hides the user's choice, render
  // as if the first visible card were expanded so the editor isn't "stuck"
  // showing nothing. Done by deriving rather than syncing via Effect.
  const effectiveExpandedKey =
    filterTerm && visible.length > 0 && !visible.some(({ v }) => v._key === expandedKey)
      ? visible[0].v._key
      : expandedKey

  const showFilter = items.length >= VARIANTS_FILTER_THRESHOLD

  return (
    <div className="variants-editor">
      <div className="variants-editor-toolbar">
        {showFilter && (
          <Input
            type="search" className="variants-filter-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Lọc theo tên / SKU / thuộc tính (${items.length} biến thể)`}
            disabled={disabled}
            aria-label="Lọc biến thể"
           />
        )}
        {showFilter && filterTerm && (
          <span className="variants-filter-status">
            {visible.length}/{items.length} khớp
          </span>
        )}
        {!disabled && onOpenMatrixWizard && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenMatrixWizard}
            title="Tạo tự động tất cả tổ hợp Size × Màu × ..."
          >
            ⊞ Sinh ma trận
          </button>
        )}
      </div>

      {visible.map(({ v, originalIdx }) => {
        const prefix = `variants.${originalIdx}.`
        const fieldErrors = Object.fromEntries(
          Object.entries(validationErrors)
            .filter(([k]) => k.startsWith(prefix))
            .map(([k, val]) => [k.slice(prefix.length), val])
        )
        return (
          <VariantCard
            key={v._key}
            variant={v}
            index={originalIdx}
            expanded={effectiveExpandedKey === v._key}
            onToggle={toggleExpanded}
            onChange={updateVariant}
            onRemove={removeVariant}
            onDuplicate={duplicateVariant}
            disabled={disabled}
            fieldErrors={fieldErrors}
          />
        )
      })}

      {filterTerm && visible.length === 0 && (
        <p className="variants-empty">Không có biến thể nào khớp với “{filter}”.</p>
      )}

      <button type="button" className="btn btn-secondary btn-sm" onClick={addVariant} disabled={disabled}>
        + Thêm biến thể
      </button>
    </div>
  )
}

// ── Draft recovery banner ──────────────────────────────────────────────────────

function DraftRecoveryBanner({ ts, onRestore, onDiscard }) {
  return (
    <div className="draft-recovery-banner">
      <span>Phát hiện bản nháp chưa lưu lúc <strong>{formatDateTime(new Date(ts).toISOString())}</strong>.</span>
      <div className="draft-recovery-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onRestore}>Khôi phục</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onDiscard}>Bỏ qua</button>
      </div>
    </div>
  )
}

// ── Publish quality checklist modal ───────────────────────────────────────────

function PublishChecklistModal({ form, onConfirm, onCancel }) {
  const items = getPublishReadiness(form)
  const blockers = items.filter((i) => !i.ok && i.required)
  const warnings = items.filter((i) => !i.ok && !i.required)

  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div className="modal-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="checklist-title">
        <h3 className="modal-title" id="checklist-title">Kiểm tra trước khi đăng bán</h3>
        <ul className="publish-checklist">
          {items.map((item) => (
            <li key={item.id} className={`checklist-item ${item.ok ? 'checklist-ok' : item.required ? 'checklist-error' : 'checklist-warn'}`}>
              <span className="checklist-icon" aria-hidden="true">{item.ok ? '✓' : item.required ? '✕' : '⚠'}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        {blockers.length > 0 && (
          <p className="modal-note modal-note--error">
            Còn <strong>{blockers.length}</strong> mục bắt buộc chưa điền. Vui lòng quay lại bổ sung.
          </p>
        )}
        {blockers.length === 0 && warnings.length > 0 && (
          <p className="modal-note modal-note--warn">
            Còn <strong>{warnings.length}</strong> mục chưa hoàn chỉnh (không bắt buộc). Bạn vẫn có thể đăng.
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Quay lại sửa</button>
          {blockers.length === 0 && (
            <button type="button" className="btn btn-success" onClick={onConfirm}>Đăng bán ngay</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Variant matrix wizard ──────────────────────────────────────────────────────

function VariantMatrixWizard({ onGenerate, onClose }) {
  const [attributes, setAttributes] = useState([
    { name: 'Màu sắc', values: '' },
    { name: 'Size', values: '' },
  ])

  function updateAttr(i, field, value) {
    setAttributes((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }
  function addAttr() {
    if (attributes.length >= 5) return
    setAttributes((prev) => [...prev, { name: '', values: '' }])
  }
  function removeAttr(i) {
    setAttributes((prev) => prev.filter((_, idx) => idx !== i))
  }

  const parsed = attributes
    .map((a) => ({ name: a.name.trim(), values: a.values.split(',').map((v) => v.trim()).filter(Boolean) }))
    .filter((a) => a.name && a.values.length > 0)

  const estimatedCount = parsed.length > 0
    ? parsed.reduce((acc, a) => acc * a.values.length, 1)
    : 0

  function cartesian(arrays) {
    return arrays.reduce((acc, arr) => acc.flatMap((x) => arr.map((y) => [...x, y])), [[]])
  }

  function generate() {
    if (!parsed.length) return
    const combos = cartesian(parsed.map((a) => a.values.map((v) => ({ name: a.name, value: v }))))
    const newVariants = combos.map((combo) => ({
      _key: crypto.randomUUID(),
      id: '',
      sku: '',
      name: combo.map((o) => o.value).join(' - '),
      stockState: 'IN_STOCK',
      imageUrl: '',
      isAvailable: true,
      options: combo.map((o) => ({ name: o.name, value: o.value })),
      gallery: [],
    }))
    onGenerate(newVariants)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-box modal-box--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <h3 className="modal-title" id="wizard-title">Sinh ma trận biến thể</h3>
        <p className="detail-section-desc" style={{ marginBottom: 16 }}>
          Nhập thuộc tính và giá trị (cách nhau bằng dấu phẩy). Hệ thống tạo tất cả tổ hợp tự động.
        </p>

        <div className="wizard-attrs">
          {attributes.map((attr, i) => (
            <div key={i} className="wizard-attr-row">
              <Input
                placeholder="Thuộc tính (vd: Màu sắc)"
                value={attr.name}
                onChange={(e) => updateAttr(i, 'name', e.target.value)}
               />
              <Input className="wizard-attr-values"
                placeholder="Giá trị (vd: Đỏ, Xanh, Trắng)"
                value={attr.values}
                onChange={(e) => updateAttr(i, 'values', e.target.value)}
               />
              <button
                type="button"
                className="btn btn-icon btn-danger-ghost"
                onClick={() => removeAttr(i)}
                disabled={attributes.length <= 1}
                aria-label="Xóa thuộc tính"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={addAttr}
          disabled={attributes.length >= 5}
          style={{ marginTop: 8 }}
        >
          + Thêm thuộc tính
        </button>

        {estimatedCount > 0 && (
          <p className={`wizard-estimate${estimatedCount > 50 ? ' wizard-estimate--warn' : ''}`}>
            Sẽ tạo <strong>{estimatedCount}</strong> biến thể
            {estimatedCount > 50 ? ' — khá nhiều, kiểm tra lại.' : '.'}
          </p>
        )}

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={generate}
            disabled={estimatedCount === 0}
          >
            Sinh {estimatedCount > 0 ? `${estimatedCount} biến thể` : 'biến thể'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function ProductDetailScreen({ productId, isCreate = false, navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(buildEmptyForm)
  // Dirty tracking via boolean flag (set true on any field update, reset on
  // load/save). JSON.stringify(form) was the previous strategy but ran on
  // every render and grew O(N) with variants count — dropped sharply when
  // some sản phẩm lên tới 100+ biến thể.
  const [isDirty, setIsDirty] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const slugEditedByUser = useRef(false)
  const [originalPublishStatus, setOriginalPublishStatus] = useState(null)

  // Autosave / draft recovery
  const autosaveKey = getAutosaveKey(productId, isCreate)
  const [draftRecovery, setDraftRecovery] = useState(null)

  // Publish checklist
  const [showPublishChecklist, setShowPublishChecklist] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(null)

  // Variant matrix wizard
  const [showMatrixWizard, setShowMatrixWizard] = useState(false)

  // Discount helper for salePrice
  const [showDiscountHelper, setShowDiscountHelper] = useState(false)
  const [discountPct, setDiscountPct] = useState('')

  const { data: fetchResult, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProductDetail(productId),
    enabled: !isCreate,
  })

  const { data: categoriesResult } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => fetchCategoryTree(),
    staleTime: 5 * 60 * 1000,
  })
  const { data: brandsResult } = useQuery({
    queryKey: ['brands-all'],
    queryFn: () => fetchBrands({ pageSize: 100 }),
    staleTime: 5 * 60 * 1000,
  })
  const categories = categoriesResult?.items ?? []
  const brands = brandsResult?.items ?? []

  useEffect(() => {
    if (!fetchResult) return
    const item = fetchResult.item || null
    const nextForm = buildFormFromItem(item)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(nextForm)
    setIsDirty(false)
    slugEditedByUser.current = Boolean(nextForm.slug)
    setOriginalPublishStatus(nextForm.publishStatus)

    // Check autosave newer than server updatedAt
    if (!isCreate && item?.updatedAt) {
      const draft = loadFormFromStorage(autosaveKey)
      if (draft?.form && draft.ts > new Date(item.updatedAt).getTime()) {
        setDraftRecovery(draft)
      }
    }
  }, [autosaveKey, fetchResult, isCreate])

  // Check autosave on mount for create mode; also handle product duplicate payload
  useEffect(() => {
    if (!isCreate) return

    // Duplicate product: pre-fill form from sessionStorage payload
    try {
      const raw = sessionStorage.getItem('product-duplicate-payload')
      if (raw) {
        sessionStorage.removeItem('product-duplicate-payload')
        const item = JSON.parse(raw)
        const base = buildFormFromItem(item)
        const duplicated = {
          ...base,
          // Clear identity fields — user must set unique values
          slug: '',
          sku: base.sku ? `${base.sku}-COPY` : '',
          publishStatus: 'DRAFT',
          isFeatured: false,
          showOnHomepage: false,
          homepageOrder: '',
          // Clear variants IDs so they create as new
          variants: base.variants.map((v) => ({ ...v, _key: crypto.randomUUID(), id: '' })),
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm(duplicated)
        setIsDirty(true)
        slugEditedByUser.current = false
        toast.success(`Đã sao chép từ "${item.name || 'sản phẩm'}". Vui lòng đặt tên và slug mới.`)
        return
      }
    } catch { /* ignore parse errors */ }

    const draft = loadFormFromStorage(autosaveKey)
    if (draft?.form) setDraftRecovery(draft)
  }, [autosaveKey, isCreate])

  // Autosave when dirty
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => saveFormToStorage(autosaveKey, form), 10_000)
    return () => clearTimeout(timer)
  }, [form, isDirty, autosaveKey])

  const state = {
    status: isCreate ? 'success' : isLoading ? 'loading' : isError ? 'error' : 'success',
    item: fetchResult?.item ?? null,
    warning: fetchResult?.mode === 'mock' ? (fetchResult?.warning ?? '') : '',
    error: fetchError?.message ?? '',
  }

  const isReadOnly = !canUpdate || isSubmitting
  const formRef = useRef(null)
  const allowedPublishStatuses = getAllowedPublishStatuses(isCreate ? null : originalPublishStatus)

  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setIsDirty(true)
    setValidationErrors((previous) => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  function handleNameChange(value) {
    updateField('name', value)
    if (!slugEditedByUser.current) {
      updateField('slug', slugify(value))
    }
  }

  function handleSlugChange(value) {
    // Release auto-sync lock when user clears the field completely.
    if (!value.trim()) {
      slugEditedByUser.current = false
    } else {
      slugEditedByUser.current = true
    }
    updateField('slug', value)
  }

  function handleSlugBlur(value) {
    const sanitized = slugify(value)
    if (sanitized !== value) {
      updateField('slug', sanitized)
    }
  }

  const saveMutation = useMutation({
    mutationFn: (payload) => isCreate ? createProduct(payload) : updateProduct(productId, payload),
    onSuccess: (response) => {
      const savedItem = response.item || null
      const nextForm = buildFormFromItem(savedItem)
      setForm(nextForm)
      setIsDirty(false)
      clearFormFromStorage(autosaveKey)
      setDraftRecovery(null)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      if (!isCreate) queryClient.setQueryData(['product', productId], response)
      toast.success(isCreate ? t('products.detail.successCreate') : t('products.detail.successUpdate'))
      setIsSubmitting(false)
      if (isCreate && savedItem?.id) navigate(`/admin/products/${savedItem.id}`, { replace: true })
    },
    onError: (error) => {
      setValidationErrors(mapValidationErrors(error))
      toast.error(error.message || t('products.detail.errSaveFailed'))
      setIsSubmitting(false)
    },
  })

  function focusFirstError() {
    // Use double-rAF so we run AFTER React's commit phase, including the
    // adjust-state-during-render pass that auto-expands a variant card.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      formRef.current?.querySelector('.field-error')
        ?.closest('label, .form-field')
        ?.querySelector('input, select, textarea')
        ?.focus()
    }))
  }

  function handleSave(overridePublishStatus) {
    if (!canUpdate) return

    const formToSave = overridePublishStatus
      ? { ...form, publishStatus: overridePublishStatus }
      : form

    const schema = createProductSchema(t, isCreate)
    const result = schema.safeParse(formToSave)
    const clientErrors = zodErrors(result)
    if (Object.keys(clientErrors).length > 0) {
      setValidationErrors(clientErrors)
      focusFirstError()
      return
    }

    // Show quality checklist when publishing for first time
    if (overridePublishStatus === 'PUBLISHED' && form.publishStatus !== 'PUBLISHED') {
      setPendingPublish({ formToSave, payload: toPayload(formToSave) })
      setShowPublishChecklist(true)
      return
    }

    setIsSubmitting(true)
    setValidationErrors({})
    saveMutation.mutate(toPayload(formToSave))
  }

  function confirmPublish() {
    if (!pendingPublish) return
    setShowPublishChecklist(false)
    setIsSubmitting(true)
    setValidationErrors({})
    saveMutation.mutate(pendingPublish.payload)
    setPendingPublish(null)
  }

  if (state.status === 'loading') {
    return (
      <StatePanel
        tone="info"
        title={t('products.detail.loading')}
        description={t('products.detail.loadingDesc')}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('products.detail.loadError')}
        description={state.error}
        actionLabel={t('products.detail.backToList')}
        onAction={() => navigate('/admin/products')}
      />
    )
  }

  if (!isCreate && !state.item) {
    return (
      <StatePanel
        tone="neutral"
        title={t('products.detail.notFound')}
        description={t('products.detail.notFoundDesc')}
        actionLabel={t('products.detail.backToList')}
        onAction={() => navigate('/admin/products')}
      />
    )
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('products.detail.eyebrow')}</p>
          <h1>{isCreate ? t('products.detail.createTitle') : t('products.detail.editTitle')}</h1>
          <p>{isCreate ? t('products.detail.createDesc') : t('products.detail.editDesc')}</p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/products')}
          >
            {t('products.detail.backToList')}
          </button>
          {!isCreate && state.item?.publishStatus !== 'PUBLISHED' ? (
            <a
              href={`/product/${form.slug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              title="Xem trước trang sản phẩm (tab mới)"
            >
              Xem trước
            </a>
          ) : null}
        </div>
      </header>

      {state.warning ? (
        <StatePanel tone="warning" title={t('readOnly.prefix')} description={state.warning} />
      ) : null}

      {!canUpdate ? (
        <StatePanel
          tone="warning"
          title={t('products.detail.permissionDenied')}
          description={t('products.detail.permissionDesc')}
        />
      ) : null}

      {draftRecovery && (
        <DraftRecoveryBanner
          ts={draftRecovery.ts}
          onRestore={() => {
            setForm(draftRecovery.form)
            setIsDirty(true)
            setDraftRecovery(null)
            slugEditedByUser.current = Boolean(draftRecovery.form.slug)
          }}
          onDiscard={() => {
            clearFormFromStorage(autosaveKey)
            setDraftRecovery(null)
          }}
        />
      )}

      {showPublishChecklist && pendingPublish && (
        <PublishChecklistModal
          form={pendingPublish.formToSave}
          onConfirm={confirmPublish}
          onCancel={() => { setShowPublishChecklist(false); setPendingPublish(null) }}
        />
      )}

      {showMatrixWizard && (
        <VariantMatrixWizard
          onGenerate={(newVariants) => updateField('variants', [...form.variants, ...newVariants])}
          onClose={() => setShowMatrixWizard(false)}
        />
      )}

      <SectionNav />

      <form
        ref={formRef}
        className="entity-form"
        onSubmit={(e) => { e.preventDefault(); handleSave() }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
            e.preventDefault()
            handleSave()
          }
        }}
      >
        {/* ── Thông tin cơ bản ── */}
        <CollapsibleSection id="section-basic" title={t('products.detail.sectionBasic')}>
          <div className="detail-section-content form-grid">
            <label className="form-field">
              <div className="form-field-label-row">
                <span>{t('products.detail.name')}</span>
                <span className={`char-counter${form.name.length > 230 ? ' char-counter-warn' : ''}`}>
                  {form.name.length} / 255
                </span>
              </div>
              <Input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isReadOnly}
                maxLength={255}
               />
              {validationErrors.name ? (
                <small className="field-error">{validationErrors.name}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>{t('products.detail.slug')}</span>
              <Input
                value={form.slug}
                placeholder="vd: mu-bao-hiem-fullface-agv-k1s"
                onChange={(e) => handleSlugChange(e.target.value)}
                onBlur={(e) => handleSlugBlur(e.target.value)}
                disabled={isReadOnly}
                maxLength={200}
               />
              {validationErrors.slug ? (
                <small className="field-error">{validationErrors.slug}</small>
              ) : (
                <small className="detail-section-desc" style={{ marginTop: 2 }}>
                  Chỉ chữ thường a–z, số 0–9 và dấu gạch ngang. Tự điền từ tên sản phẩm.
                </small>
              )}
            </label>

            <label className="form-field">
              <div className="form-field-label-row">
                <span>{t('products.detail.sku')}</span>
                <span className={`char-counter${form.sku.length > 85 ? ' char-counter-warn' : ''}`}>
                  {form.sku.length} / 100
                </span>
              </div>
              <Input
                value={form.sku}
                onChange={(e) => updateField('sku', e.target.value)}
                disabled={isReadOnly}
                maxLength={100}
               />
              <small className="detail-section-desc" style={{ marginTop: 2 }}>
                {t('products.detail.skuHint')}
              </small>
            </label>

            <label className="form-field">
              <span>{t('products.detail.categoryId')}</span>
              <Select
                value={form.categoryId}
                onValueChange={(val) => updateField('categoryId', val)}
                disabled={isReadOnly}
              ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                {form.categoryId && !categories.some((c) => c.id === form.categoryId) && (
                  <SelectItem value={form.categoryId} disabled>ID: {form.categoryId} (không tìm thấy)</SelectItem>
                )}
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent></Select>
              {validationErrors.categoryId ? (
                <small className="field-error">{validationErrors.categoryId}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>{t('products.detail.brandId')}</span>
              <Select
                value={form.brandId}
                onValueChange={(val) => updateField('brandId', val)}
                disabled={isReadOnly}
              ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                {form.brandId && !brands.some((b) => b.id === form.brandId) && (
                  <SelectItem value={form.brandId} disabled>ID: {form.brandId} (không tìm thấy)</SelectItem>
                )}
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent></Select>
            </label>

            <div className="form-field form-field-wide">
              <div className="form-field-label-row">
                <span>{t('products.detail.shortDescription')}</span>
                <span className={`char-counter${form.shortDescription.length > 450 ? ' char-counter-warn' : ''}`}>
                  {form.shortDescription.length} / 500
                </span>
              </div>
              <Textarea className="${validationErrors.shortDescription ? ' input-error' : ''}"
                value={form.shortDescription}
                onChange={(e) => updateField('shortDescription', e.target.value)}
                maxLength={500}
                placeholder="Vd: Mũ fullface AGV K1S đạt chuẩn ECE 22.06, vỏ composite 1.5kg, kính chống xước, phù hợp đi đường trường…"
                disabled={isReadOnly}
               />
              <small className="detail-section-desc" style={{ marginTop: 4 }}>
                Hiển thị dưới tiêu đề ở trang chi tiết và trong danh sách sản phẩm. Tối thiểu 20 ký tự, lý tưởng 80–160 ký tự.
              </small>
              {validationErrors.shortDescription ? (
                <small className="field-error">{validationErrors.shortDescription}</small>
              ) : null}
            </div>

            <div className="form-field form-field-wide">
              <div className="form-field-label-row">
                <span>{t('products.detail.description')}</span>
                {form.description.length > 15000 && (
                  <span className={`char-counter${form.description.length > 19000 ? ' char-counter-warn' : ''}`}>
                    {form.description.length.toLocaleString()} / 20 000
                  </span>
                )}
              </div>
              <RichTextEditor
                value={form.description}
                onChange={(html) => updateField('description', html)}
                placeholder="Nhập mô tả chi tiết sản phẩm..."
                disabled={isReadOnly}
                hasError={Boolean(validationErrors.description)}
                enableImagePicker
              />
              {validationErrors.description && (
                <small className="field-error">{validationErrors.description}</small>
              )}
            </div>

            <div className="form-field form-checkboxes-row form-field-wide">
              <label className="form-checkbox">
                <Checkbox
                  checked={form.isFeatured}
                  onCheckedChange={(checked) => updateField('isFeatured', checked)}
                  disabled={isReadOnly}
                 />
                <span>{t('products.detail.isFeatured')}</span>
              </label>
              <label className="form-checkbox">
                <Checkbox
                  checked={form.showOnHomepage}
                  onCheckedChange={(checked) => updateField('showOnHomepage', checked)}
                  disabled={isReadOnly}
                 />
                <span>{t('products.detail.showOnHomepage')}</span>
              </label>
              <small className="detail-section-desc" style={{ marginTop: 4, width: '100%' }}>
                Trang chủ chỉ hiển thị tối đa 12 sản phẩm <b>Nổi bật</b> và 10 sản phẩm <b>Trang chủ</b>.
                Một sản phẩm bật cả hai cờ chỉ hiện ở khối "Nổi bật" để tránh trùng. Dùng ô
                "Thứ tự trang chủ" bên dưới để ghim sản phẩm lên đầu (số nhỏ = lên trước).
              </small>
              {(form.isFeatured || form.showOnHomepage) && form.publishStatus !== 'PUBLISHED' && (
                <small className="detail-section-desc" style={{ color: 'var(--admin-color-warning, #d97706)', marginTop: 4, width: '100%' }}>
                  Sản phẩm chưa được Xuất bản — bật tùy chọn này sẽ không hiển thị trên web cho đến khi trạng thái chuyển sang Xuất bản.
                </small>
              )}
            </div>

            {(form.isFeatured || form.showOnHomepage) && (
              <label className="form-field" style={{ maxWidth: 240 }}>
                <span>Thứ tự trang chủ</span>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={0}
                  value={form.homepageOrder}
                  onChange={(e) => updateField('homepageOrder', e.target.value)}
                  placeholder="VD: 1"
                  disabled={isReadOnly}
                />
                <small className="detail-section-desc">
                  Để trống nếu không cần ghim — sản phẩm sẽ xếp theo ngày tạo mới nhất.
                  Số nhỏ hơn sẽ hiển thị trước.
                </small>
              </label>
            )}
          </div>
        </CollapsibleSection>

        {/* ── Giá & Trạng thái ── */}
        <CollapsibleSection id="section-pricing" title={t('products.detail.sectionPricing')}>
          {form.variants.length > 0 && (
            <div className="section-info-banner">
              Sản phẩm này có biến thể — giá dưới đây áp dụng chung cho tất cả biến thể. Giỏ hàng và thanh toán đều dùng giá này.
            </div>
          )}
          <div className="detail-section-content form-grid">
            <label className="form-field">
              <span>{t('products.detail.retailPrice')}</span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="vd: 5.900.000"
                value={formatPrice(form.retailPrice)}
                onChange={(e) => updateField('retailPrice', e.target.value.replace(/\D/g, ''))}
                disabled={isReadOnly}
               />
              {validationErrors.retailPrice ? (
                <small className="field-error">{validationErrors.retailPrice}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span title="Giá gốc sẽ hiển thị gạch ngang khi có giá khuyến mãi">
                Giá gốc (gạch ngang) ℹ
              </span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="vd: 6.500.000"
                value={formatPrice(form.compareAtPrice)}
                onChange={(e) => updateField('compareAtPrice', e.target.value.replace(/\D/g, ''))}
                disabled={isReadOnly}
               />
              {validationErrors.compareAtPrice ? (
                <small className="field-error">{validationErrors.compareAtPrice}</small>
              ) : null}
            </label>

            <div className="form-field">
              <span>{t('products.detail.salePrice')}</span>
              <div className="discount-row">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="vd: 5.500.000"
                  value={formatPrice(form.salePrice)}
                  onChange={(e) => updateField('salePrice', e.target.value.replace(/\D/g, ''))}
                  disabled={isReadOnly}
                 />
                {!isReadOnly && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm discount-pct-btn"
                    onClick={() => setShowDiscountHelper((p) => !p)}
                    title="Tính giảm theo %"
                  >
                    % giảm
                  </button>
                )}
              </div>
              {showDiscountHelper && !isReadOnly && (
                <div className="discount-helper">
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    placeholder="% giảm (vd: 20)"
                    value={discountPct}
                    onChange={(e) => setDiscountPct(e.target.value)}
                   />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!(Number(form.retailPrice) || Number(form.compareAtPrice))}
                    onClick={() => {
                      const base = Number(form.retailPrice) || Number(form.compareAtPrice)
                      const pct = Number(discountPct)
                      if (base > 0 && pct > 0 && pct < 100) {
                        updateField('salePrice', String(Math.round(base * (1 - pct / 100))))
                        setShowDiscountHelper(false)
                        setDiscountPct('')
                      }
                    }}
                  >
                    Áp dụng
                  </button>
                  <small className="detail-section-desc" style={{ marginTop: 0 }}>
                    {(Number(form.retailPrice) || Number(form.compareAtPrice))
                      ? 'Tính từ giá niêm yết (hoặc giá gốc nếu không có).'
                      : 'Vui lòng nhập Giá niêm yết hoặc Giá gốc trước.'}
                  </small>
                </div>
              )}
              {validationErrors.salePrice ? (
                <small className="field-error">{validationErrors.salePrice}</small>
              ) : form.salePrice && form.retailPrice && Number(form.salePrice) >= Number(form.retailPrice) ? (
                <small className="field-error">Giá sale phải thấp hơn giá niêm yết.</small>
              ) : null}
            </div>

            <label className="form-field">
              <span>{t('products.detail.stockState')}</span>
              <Select
                value={form.stockState}
                onValueChange={(val) => updateField('stockState', val)}
                disabled={isReadOnly || form.forceOutOfStock}
              ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="IN_STOCK">{t('status.stock.IN_STOCK')}</SelectItem>
                <SelectItem value="LOW_STOCK">{t('status.stock.LOW_STOCK')}</SelectItem>
                <SelectItem value="OUT_OF_STOCK">{t('status.stock.OUT_OF_STOCK')}</SelectItem>
              </SelectContent></Select>
              {validationErrors.stockState ? (
                <small className="field-error">{validationErrors.stockState}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>{t('products.detail.publishStatus')}</span>
              <Select
                value={form.publishStatus}
                onValueChange={(val) => updateField('publishStatus', val)}
                disabled={isReadOnly}
              ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                {!['DRAFT', 'PUBLISHED', 'HIDDEN', 'TRASH'].includes(form.publishStatus) && (
                  <option value={form.publishStatus} disabled>
                    {t('products.detail.specialPublishNote', { state: form.publishStatus })}
                  </option>
                )}
                <SelectItem value="DRAFT" disabled ={!allowedPublishStatuses.includes('DRAFT')}>{t('status.publish.DRAFT')}</SelectItem>
                <SelectItem value="PUBLISHED" disabled ={!allowedPublishStatuses.includes('PUBLISHED')}>{t('status.publish.PUBLISHED')}</SelectItem>
                <SelectItem value="HIDDEN" disabled ={!allowedPublishStatuses.includes('HIDDEN')}>{t('status.publish.HIDDEN')}</SelectItem>
              </SelectContent></Select>
              {validationErrors.publishStatus ? (
                <small className="field-error">{validationErrors.publishStatus}</small>
              ) : null}
            </label>

            <div className="form-field">
              <label className="form-checkbox">
                <Checkbox
                  checked={form.forceOutOfStock}
                  onCheckedChange={(checked) => updateField('forceOutOfStock', checked)}
                  disabled={isReadOnly}
                 />
                <span>{t('products.detail.forceOutOfStock')}</span>
              </label>
              {form.forceOutOfStock && (
                <small className="detail-section-desc" style={{ marginTop: 4 }}>
                  Sản phẩm sẽ hiển thị "Hết hàng" và không cho mua trên web, bất kể giá trị Tồn kho ở trên.
                </small>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Ảnh đại diện ── */}
        <CollapsibleSection id="section-media" title="Ảnh đại diện">
          <div className="detail-section-content form-grid">
            <div className="form-field form-field-wide">
              <span className="form-field-label">{t('products.detail.imageUrl')}</span>
              <ImageUrlInput
                value={form.imageUrl}
                onChange={(url) => updateField('imageUrl', url)}
                alt={form.imageAlt}
                onAltChange={(alt) => updateField('imageAlt', alt)}
                disabled={isReadOnly}
                error={validationErrors.imageUrl}
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* ── SEO ── */}
        <CollapsibleSection id="section-seo" title={t('products.detail.sectionSeo')}>
          <div className="detail-section-content form-grid">
            <label className="form-field form-field-wide">
              <div className="form-field-label-row">
                <span>{t('products.detail.seoTitle')}</span>
                <span className={`char-counter${form.seoTitle.length > 220 ? ' char-counter-warn' : ''}`}>
                  {form.seoTitle.length} / 255
                </span>
              </div>
              <Input className={validationErrors.seoTitle  ? 'border-danger' : undefined}
                type="text"
                maxLength={255}
                value={form.seoTitle}
                onChange={(e) => updateField('seoTitle', e.target.value)}
                disabled={isReadOnly}
               />
              {validationErrors.seoTitle ? (
                <small className="field-error">{validationErrors.seoTitle}</small>
              ) : null}
            </label>

            <label className="form-field form-field-wide">
              <div className="form-field-label-row">
                <span>{t('products.detail.seoDescription')}</span>
                <span className={`char-counter${form.seoDescription.length > 4500 ? ' char-counter-warn' : ''}`}>
                  {form.seoDescription.length.toLocaleString()} / 5 000
                </span>
              </div>
              <Textarea className="${validationErrors.seoDescription ? ' input-error' : ''}"
                value={form.seoDescription}
                onChange={(e) => updateField('seoDescription', e.target.value)}
                maxLength={5000}
                placeholder="Nhập mô tả SEO ngắn gọn cho kết quả tìm kiếm..."
                disabled={isReadOnly}
               />
              {validationErrors.seoDescription ? (
                <small className="field-error">{validationErrors.seoDescription}</small>
              ) : null}
            </label>

            <label className="form-field form-field-wide">
              <span>{t('products.detail.seoCanonicalUrl')}</span>
              <Input className={validationErrors.seoCanonicalUrl  ? 'border-danger' : undefined}
                type="url"
                maxLength={2048}
                placeholder="https://bigbike.vn/san-pham/..."
                value={form.seoCanonicalUrl}
                onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
                disabled={isReadOnly}
               />
              <small className="detail-section-desc" style={{ marginTop: 4 }}>
                URL chuẩn để search engine index đúng trang sản phẩm.
              </small>
              {validationErrors.seoCanonicalUrl ? (
                <small className="field-error">{validationErrors.seoCanonicalUrl}</small>
              ) : null}
            </label>

            <div className="form-field form-field-wide">
              <span className="form-field-label">{t('products.detail.seoOgImageUrl')}</span>
              <ImageUrlInput
                value={form.seoOgImageUrl}
                onChange={(url) => updateField('seoOgImageUrl', url)}
                alt={form.seoOgImageAlt}
                onAltChange={(alt) => updateField('seoOgImageAlt', alt)}
                disabled={isReadOnly}
                error={validationErrors.seoOgImageUrl}
              />
              {validationErrors.seoOgImageAlt ? (
                <small className="field-error">{validationErrors.seoOgImageAlt}</small>
              ) : null}
            </div>

            <div className="form-field form-checkboxes-row form-field-wide">
              <label className="form-checkbox">
                <Checkbox
                  checked={form.seoNoIndex}
                  onCheckedChange={(checked) => updateField('seoNoIndex', checked)}
                  disabled={isReadOnly}
                 />
                <span>{t('products.detail.seoNoIndex')}</span>
              </label>
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Nội dung SEO dài ── */}
        <CollapsibleSection id="section-content-bottom" title={t('products.detail.sectionContentBottom')}>
          <div className="detail-section-content">
            <div className="form-field form-field-wide">
              <div className="form-field-label-row">
                <span>{t('products.detail.contentBottom')}</span>
                {form.contentBottom.length > 15000 && (
                  <span className={`char-counter${form.contentBottom.length > 45000 ? ' char-counter-warn' : ''}`}>
                    {form.contentBottom.length.toLocaleString()} / 50 000
                  </span>
                )}
              </div>
              <RichTextEditor
                value={form.contentBottom}
                onChange={(html) => updateField('contentBottom', html)}
                placeholder="Nhập nội dung SEO dài hiển thị dưới phần mô tả sản phẩm..."
                disabled={isReadOnly}
                hasError={Boolean(validationErrors.contentBottom)}
                enableImagePicker
              />
              {validationErrors.contentBottom ? (
                <small className="field-error">{validationErrors.contentBottom}</small>
              ) : null}
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Gallery ── */}
        <CollapsibleSection id="section-gallery" title="Gallery ảnh" description="Các ảnh bổ sung hiển thị trong slider sản phẩm">
          <div className="detail-section-content">
            <GalleryEditor
              items={form.gallery}
              onChange={(next) => updateField('gallery', next)}
              disabled={isReadOnly}
              validationErrors={validationErrors}
            />
          </div>
        </CollapsibleSection>

        {/* ── Videos ── */}
        <CollapsibleSection id="section-videos" title="Video" description="Link YouTube hoặc video sản phẩm">
          <div className="detail-section-content">
            <VideoEditor
              items={form.videos}
              onChange={(next) => updateField('videos', next)}
              disabled={isReadOnly}
              validationErrors={validationErrors}
            />
          </div>
        </CollapsibleSection>

        {/* ── Thông số kỹ thuật ── */}
        <CollapsibleSection id="section-specs" title="Thông số kỹ thuật" description={'Hiển thị trong tab "Thông số kỹ thuật" trang sản phẩm'}>
          <div className="detail-section-content">
            <SpecificationsEditor
              items={form.specifications}
              onChange={(next) => updateField('specifications', next)}
              disabled={isReadOnly}
              validationErrors={validationErrors}
            />
          </div>
        </CollapsibleSection>

        {/* ── Biến thể ── */}
        <CollapsibleSection id="section-variants" title="Biến thể sản phẩm" description="Size, màu sắc và các tùy chọn khác">
          <div className="detail-section-content">
            <VariantsEditor
              items={form.variants}
              onChange={(next) => updateField('variants', next)}
              disabled={isReadOnly}
              validationErrors={validationErrors}
              onOpenMatrixWizard={() => setShowMatrixWizard(true)}
            />
          </div>
        </CollapsibleSection>

        <div className="form-footer">
          <div className="form-status">
            <span className={`status-pill ${isDirty ? 'is-dirty' : 'is-clean'}`}>
              {isDirty ? t('common.dirty') : t('common.clean')}
            </span>
            {!isCreate && state.item?.updatedAt ? (
              <small>{t('common.lastUpdated')} {formatDateTime(state.item.updatedAt)}</small>
            ) : null}
          </div>
          <div className="screen-actions">
            {form.publishStatus !== 'PUBLISHED' && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isReadOnly || !isDirty || isSubmitting}
                title="Lưu giữ trạng thái nháp"
                onClick={() => handleSave('DRAFT')}
              >
                {isSubmitting ? t('common.saving') : 'Lưu nháp'}
              </button>
            )}
            <button
              type="button"
              className={`btn ${form.publishStatus === 'PUBLISHED' ? 'btn-primary' : 'btn-success'}`}
              disabled={isReadOnly || !isDirty || isSubmitting}
              title={form.publishStatus === 'PUBLISHED' ? 'Cmd+Enter / Ctrl+Enter' : 'Lưu và đăng sản phẩm lên web'}
              onClick={() => handleSave(form.publishStatus === 'PUBLISHED' ? undefined : 'PUBLISHED')}
            >
              {isSubmitting
                ? t('common.saving')
                : form.publishStatus === 'PUBLISHED'
                  ? (isCreate ? t('products.detail.createBtn') : t('products.detail.saveBtn'))
                  : (isCreate ? 'Tạo & Đăng bán' : 'Lưu & Đăng bán')}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
