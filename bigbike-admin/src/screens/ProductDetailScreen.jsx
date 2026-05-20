import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertCircle, Check, ChevronDown, Info, Loader2, Lock, Save, Search as PfSearch, Users, X,
} from 'lucide-react'
import {
  createProduct,
  fetchBrands,
  fetchCategoryTree,
  fetchProductDetail,
  fetchProducts,
  mapValidationErrors,
  updateProduct,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime } from '../lib/formatters'
import { createProductSchema, zodErrors, COLOR_ATTRIBUTE_KEYS, normalizeVariantToken, isColorAttributeName } from '../lib/schemas'
import { Modal, Screen, ScreenHeader, StickyActionBar, Tabs } from '../components/layout'
import { StatePanel } from '../components/StatePanel'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { MediaPickerModal } from '../components/MediaPickerModal'
import { VideoPickerModal } from '../components/VideoPickerModal'
import { RichTextEditor } from '../components/RichTextEditor'
import { BlockEditor } from '../components/BlockEditor'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

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

function getPublishReadiness(form, t) {
  const items = [
    { id: 'name', label: t('products.detail.checklist.name'), ok: Boolean(form.name.trim()), required: true },
    { id: 'image', label: t('products.detail.checklist.image'), ok: Boolean(form.imageUrl.trim()), required: false },
    { id: 'price', label: t('products.detail.checklist.price'), ok: Boolean(form.retailPrice?.trim()), required: true },
    { id: 'shortDesc', label: t('products.detail.checklist.shortDesc'), ok: form.shortDescription.trim().length >= 20, required: false },
    { id: 'desc', label: t('products.detail.checklist.desc'), ok: form.description.trim().length > 50, required: false },
  ]


  return items
}

// ── Empty form builders ────────────────────────────────────────────────────────

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
    descriptionBlocks: null,
    contentBottom: '',
    promotionContent: '',
    installationGuide: '',
    brandId: '',
    categoryId: '',
    retailPrice: '',
    compareAtPrice: '',
    salePrice: '',
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
    homepageBlock: 'NONE',
    homepageOrder: '',
    gallery: [],
    videos: [],
    specifications: [],
    faqs: [],
    variants: [],
    relatedProductIds: [],
    relatedProductChips: [],
    // Optional English content (V136). Vietnamese above stays canonical.
    translations: { en: buildEmptyTranslation() },
  }
}

// English product-level content — eight optional translatable text fields.
function buildEmptyTranslation() {
  return {
    name: '',
    shortDescription: '',
    description: '',
    contentBottom: '',
    promotionContent: '',
    installationGuide: '',
    seoTitle: '',
    seoDescription: '',
  }
}

function buildFormFromItem(item) {
  if (!item) return buildEmptyForm()

  const variants = withColorScopedMedia((item.variants || []).map((v) => ({
    _key: v.id || crypto.randomUUID(),
    id: v.id || '',
    sku: v.sku || '',
    name: v.name || '',
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
    descriptionBlocks: item.descriptionBlocks ?? null,
    contentBottom: item.contentBottom || '',
    promotionContent: item.promotionContent || '',
    installationGuide: item.installationGuide || '',
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
    homepageBlock: item.homepageBlock || 'NONE',
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
      nameEn: s.nameEn || '',
      valueEn: s.valueEn || '',
      groupNameEn: s.groupEn || '',
    })),
    faqs: (item.faqs || []).map((f) => ({
      _key: crypto.randomUUID(),
      question: f.question || '',
      answer: f.answer || '',
      questionEn: f.questionEn || '',
      answerEn: f.answerEn || '',
    })),
    variants,
    relatedProductIds: (item.relatedProducts || []).map((p) => p.id).filter(Boolean),
    relatedProductChips: (item.relatedProducts || [])
      .filter((p) => p && p.id)
      .map((p) => ({
        id: p.id,
        name: p.name || p.id,
        slug: p.slug || '',
        imageUrl: p.image?.url || '',
      })),
    translations: { en: translationFormFromItem(item.translations?.en) },
  }
}

// Map a normalized `translations.en` block to the form shape — every field a
// controlled string ('' when not translated), never undefined.
function translationFormFromItem(en) {
  const source = en && typeof en === 'object' ? en : {}
  const empty = buildEmptyTranslation()
  return Object.fromEntries(
    Object.keys(empty).map((key) => [key, source[key] || '']),
  )
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

// English product-level content → upsert payload. Blank fields become undefined
// so the backend stores null. English is optional (PRODUCT_RULE_001).
function translationToPayload(en) {
  const source = en && typeof en === 'object' ? en : {}
  const out = {}
  for (const key of Object.keys(buildEmptyTranslation())) {
    const trimmed = String(source[key] || '').trim()
    out[key] = trimmed || undefined
  }
  return out
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
    description: Array.isArray(form.descriptionBlocks) ? undefined : (form.description.trim() || undefined),
    contentBottom: form.contentBottom.trim() ? form.contentBottom.trim() : null,
    promotionContent: form.promotionContent.trim() ? form.promotionContent.trim() : null,
    installationGuide: form.installationGuide.trim() ? form.installationGuide.trim() : null,
    brandId: form.brandId.trim() || undefined,
    categoryId: form.categoryId.trim(),
    // Send null when cleared so backend (presence-flag logic) can distinguish
    // "user erased this" from "field not part of this request".
    retailPrice: toIntegerOrNull(form.retailPrice),
    compareAtPrice: toIntegerOrNull(form.compareAtPrice),
    salePrice: toIntegerOrNull(form.salePrice),
    currency: 'VND',
    forceOutOfStock: Boolean(form.forceOutOfStock),
    publishStatus: form.publishStatus,
    homepageBlock: form.homepageBlock || 'NONE',
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
    // Optional English content (V136). Always sent so the backend full-replaces
    // the English columns; empty fields clear them. English is never required.
    translations: { en: translationToPayload(form.translations?.en) },
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
      // Optional English content (V136) — rides on the same row as Vietnamese.
      nameEn: (s.nameEn || '').trim() || undefined,
      valueEn: (s.valueEn || '').trim() || undefined,
      groupNameEn: (s.groupNameEn || '').trim() || undefined,
      sortOrder: i,
    }))

  payload.faqs = form.faqs
    .filter((f) => f.question.trim() && f.answer.trim())
    .map((f, i) => ({
      question: f.question.trim(),
      answer: f.answer.trim(),
      questionEn: (f.questionEn || '').trim() || undefined,
      answerEn: (f.answerEn || '').trim() || undefined,
      sortOrder: i,
    }))

  // Always send relatedProductIds — empty array explicitly clears the section.
  payload.relatedProductIds = Array.isArray(form.relatedProductIds) ? form.relatedProductIds : []

  // descriptionBlocks — send when user is in block-editing mode (non-null).
  // Strip _key (frontend tracking) before sending. Omit key entirely when null
  // so the backend presence-flag leaves both columns untouched.
  if (Array.isArray(form.descriptionBlocks)) {
    payload.descriptionBlocks = form.descriptionBlocks.map(({ _key, ...rest }) => rest)
  }

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
  const { t } = useTranslation()
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
        aria-label={t('products.detail.gallery.pickImage')}
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
            aria-label={t('products.detail.gallery.removeImage')}
          >
            ✕
          </button>
        )}
      </div>
      <div className="gallery-card-body">
        <Button
          variant="outline"
          size="sm"
          className="gallery-card-pick-btn"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
        >
          {trimmed ? t('products.detail.gallery.changeImage') : t('products.detail.gallery.pickImage')}
        </Button>
        <input
          type="text"
          className="gallery-card-alt-input"
          placeholder={t('products.detail.gallery.altPlaceholder')}
          value={item.alt || ''}
          onChange={(e) => onUpdate('alt', e.target.value)}
          disabled={disabled}
          aria-label={t('products.detail.gallery.altAriaLabel')}
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
  const { t } = useTranslation()
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
            key={item.url || `gallery-${index}`}
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
            <span>{t('products.detail.gallery.addImage')}</span>
          </button>
        )}
      </div>
      {!disabled && (
        <Button
          variant="outline"
          size="sm"
          className="gallery-multi-pick-btn"
          onClick={() => setMultiPickerOpen(true)}
          title={t('products.detail.gallery.multiSelectTitle')}
        >
          + {t('products.detail.gallery.multiSelect')}
        </Button>
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
  const { t } = useTranslation()
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
          <div key={item.url || `video-${index}`} className="list-editor-row">
            <div className="list-editor-fields">
              <div className="flex gap-1 p-1 bg-muted w-fit">
                <Button
                  type="button"
                  variant={type === 'youtube' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateItem(index, { type: 'youtube', url: '', thumbnailUrl: '' })}
                  disabled={disabled}
                >
                  YouTube
                </Button>
                <Button
                  type="button"
                  variant={type === 'upload' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateItem(index, { type: 'upload', url: '' })}
                  disabled={disabled}
                >
                  {t('products.detail.video.fromLibrary')}
                </Button>
              </div>

              {type === 'youtube' ? (
                <div>
                  <Input className={urlError  ? 'border-danger' : undefined}
                    placeholder={t('products.detail.video.youtubePlaceholder')}
                    value={item.url}
                    onChange={(e) => updateItem(index, { url: e.target.value })}
                    disabled={disabled}
                   />
                  {urlError && <small className="field-error">{urlError}</small>}
                  {ytId && (
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                      alt={t('products.detail.video.youtubePreviewAlt')}
                      className="mt-2 w-full max-w-60 h-auto rounded border border-border"
                    />
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className={urlError ? 'input-error' : undefined}
                      onClick={() => setPickerOpenIndex(index)}
                      disabled={disabled}
                    >
                      {item.url ? t('products.detail.video.changeVideo') : t('products.detail.video.pickFromLibrary')}
                    </Button>
                    {item.url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => updateItem(index, { url: '' })}
                        disabled={disabled}
                        aria-label={t('products.detail.video.removeSelectedVideo')}
                      >
                        ✕
                      </Button>
                    )}
                    {item.url && (
                      <span className="truncate max-w-xs text-xs text-muted-foreground">
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
                      className="mt-2 w-full max-w-xs h-auto rounded border border-border"
                    />
                  )}
                  <div className="flex flex-col gap-1 mt-2">
                    <span className="text-xs text-muted-foreground">{t('products.detail.video.thumbnailOptional')}</span>
                    <ImageUrlInput
                      value={item.thumbnailUrl || ''}
                      onChange={(url) => updateItem(index, { thumbnailUrl: url })}
                      disabled={disabled}
                    />
                  </div>
                </div>
              )}

              <Input
                placeholder={t('products.detail.video.titlePlaceholder')}
                value={item.title}
                onChange={(e) => updateItem(index, { title: e.target.value })}
                disabled={disabled}
               />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeItem(index)}
              disabled={disabled}
              aria-label={t('products.detail.video.removeVideo')}
            >
              ✕
            </Button>
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.video.addVideo')}
      </Button>
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

function SpecificationsEditor({ items, onChange, disabled, validationErrors, contentLang = 'vi' }) {
  const { t } = useTranslation()
  // Which field each input binds to depends on the active content language (V136).
  const isEn = contentLang === 'en'
  const fName = isEn ? 'nameEn' : 'name'
  const fValue = isEn ? 'valueEn' : 'value'
  const fGroup = isEn ? 'groupNameEn' : 'groupName'
  function updateItem(index, field, value) {
    const next = items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    onChange(next)
  }
  function addItem() {
    onChange([...items, {
      _key: crypto.randomUUID(),
      name: '', value: '', groupName: '',
      nameEn: '', valueEn: '', groupNameEn: '',
    }])
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
        <p className="list-editor-empty">{t('products.detail.specs.empty')}</p>
      )}
      {items.map((item, index) => {
        const errName = validationErrors?.[`specifications.${index}.name`]
        const errValue = validationErrors?.[`specifications.${index}.value`]
        const errGroup = validationErrors?.[`specifications.${index}.groupName`]
        return (
          <div key={item._key} className="list-editor-row list-editor-row--stack">
            <div className="list-editor-reorder">
              <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
              <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
            </div>
            <div className="list-editor-fields list-editor-fields-3col flex-1">
              <div>
                <Input className={errGroup  ? 'border-danger' : undefined}
                  placeholder={t('products.detail.specs.groupPlaceholder')}
                  title={t('products.detail.specs.groupTitle')}
                  value={item[fGroup] || ''}
                  onChange={(e) => updateItem(index, fGroup, e.target.value)}
                  disabled={disabled}
                  maxLength={100}
                 />
                {errGroup && <small className="field-error">{errGroup}</small>}
              </div>
              <div>
                <Input className={errName  ? 'border-danger' : undefined}
                  placeholder={t('products.detail.specs.namePlaceholder')}
                  value={item[fName] || ''}
                  onChange={(e) => updateItem(index, fName, e.target.value)}
                  disabled={disabled}
                  maxLength={255}
                 />
                {errName && <small className="field-error">{errName}</small>}
              </div>
              <div>
                <Input className={errValue  ? 'border-danger' : undefined}
                  placeholder={t('products.detail.specs.valuePlaceholder')}
                  value={item[fValue] || ''}
                  onChange={(e) => updateItem(index, fValue, e.target.value)}
                  disabled={disabled}
                  maxLength={2000}
                 />
                {errValue && <small className="field-error">{errValue}</small>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeItem(index)}
              disabled={disabled}
              aria-label={t('products.detail.specs.removeSpec')}
            >
              ✕
            </Button>
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.specs.addSpec')}
      </Button>
    </div>
  )
}

function FaqEditor({ items, onChange, disabled, validationErrors, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fQuestion = isEn ? 'questionEn' : 'question'
  const fAnswer = isEn ? 'answerEn' : 'answer'
  function updateItem(index, field, value) {
    const next = items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    onChange(next)
  }
  function addItem() {
    onChange([...items, { _key: crypto.randomUUID(), question: '', answer: '', questionEn: '', answerEn: '' }])
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
        <p className="list-editor-empty">{t('products.detail.faqs.empty')}</p>
      )}
      {items.map((item, index) => {
        const errQuestion = validationErrors?.[`faqs.${index}.question`]
        const errAnswer = validationErrors?.[`faqs.${index}.answer`]
        return (
          <div key={item._key} className="list-editor-row list-editor-row--stack">
            <div className="list-editor-reorder">
              <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
              <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div>
                <Input className={errQuestion ? 'border-danger' : undefined}
                  placeholder={t('products.detail.faqs.questionPlaceholder')}
                  value={item[fQuestion] || ''}
                  onChange={(e) => updateItem(index, fQuestion, e.target.value)}
                  disabled={disabled}
                  maxLength={500}
                />
                {errQuestion && <small className="field-error">{errQuestion}</small>}
              </div>
              <div>
                <Textarea className={errAnswer ? 'border-danger' : undefined}
                  placeholder={t('products.detail.faqs.answerPlaceholder')}
                  value={item[fAnswer] || ''}
                  onChange={(e) => updateItem(index, fAnswer, e.target.value)}
                  disabled={disabled}
                  rows={3}
                  maxLength={20000}
                />
                {errAnswer && <small className="field-error">{errAnswer}</small>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeItem(index)}
              disabled={disabled}
              aria-label={t('products.detail.faqs.removeFaq')}
            >
              ✕
            </Button>
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.faqs.addFaq')}
      </Button>
    </div>
  )
}

function VariantOptionsEditor({ options, onChange, disabled }) {
  const { t } = useTranslation()
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
            placeholder={t('products.detail.variant.optionNamePlaceholder')}
            value={opt.name}
            onChange={(e) => updateOption(i, 'name', e.target.value)}
            disabled={disabled}
           />
          <Input
            placeholder={t('products.detail.variant.optionValuePlaceholder')}
            value={opt.value}
            onChange={(e) => updateOption(i, 'value', e.target.value)}
            disabled={disabled}
           />
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeOption(i)}
            disabled={disabled}
            aria-label={t('products.detail.variant.removeOption')}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addOption} disabled={disabled}>
        + {t('products.detail.variant.addOption')}
      </Button>
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
  const { t } = useTranslation()
  function updateField(field, value) {
    onChange(variant._key, { [field]: value })
  }

  const label = variant.name.trim() || t('products.detail.variant.defaultLabel', { index: index + 1 })
  const optionSummary = variant.options.filter((o) => o.name && o.value).map((o) => `${o.name}: ${o.value}`).join(', ')
  const hasErrors = Object.keys(fieldErrors).length > 0
  const colorValue = getVariantColorValue(variant)
  const hasColor = Boolean(colorValue)

  return (
    <div className={`variant-card${hasErrors ? ' variant-card--error' : ''}`}>
      <div className="variant-card-header">
        {/* Vùng click/Enter/Space để toggle — không bao bọc các nút action */}
        <button
          type="button"
          className="variant-card-toggle-area"
          onClick={() => onToggle(variant._key)}
          aria-expanded={expanded}
        >
          <div className="variant-card-title">
            <span className="variant-card-index">#{index + 1}</span>
            <span>{label}</span>
            {optionSummary && <span className="variant-card-summary">{optionSummary}</span>}
            {hasErrors && <span className="variant-card-error-badge" title={t('products.detail.variant.hasError')}>!</span>}
          </div>
          <span className="variant-card-toggle" aria-hidden="true">{expanded ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        <div className="variant-card-actions">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(variant._key)}
            disabled={disabled}
            aria-label={t('products.detail.variant.duplicate')}
            title={t('products.detail.variant.duplicate')}
          >
            ⎘
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(variant._key)}
            disabled={disabled}
            aria-label={t('products.detail.variant.remove')}
          >
            ✕
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="variant-card-body form-grid">
          <label className="form-field">
            <span>{t('products.detail.variant.name')}</span>
            <Input
              value={variant.name}
              onChange={(e) => updateField('name', e.target.value)}
              disabled={disabled}
              placeholder={t('products.detail.variant.namePlaceholder')}
             />
            {fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}
          </label>

          <label className="form-field">
            <span>{t('products.detail.variant.sku')}</span>
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

          <div className="form-field form-field-wide">
            <span className="form-field-label">
              {hasColor
                ? t('products.detail.variant.colorImageLabelWithValue', { color: colorValue })
                : t('products.detail.variant.colorImageLabel')}
            </span>
            <p className="detail-section-desc mt-0 mb-2">
              {hasColor
                ? t('products.detail.variant.colorImageHintWithColor')
                : t('products.detail.variant.colorImageHintNoColor')}
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
            <span>{t('products.detail.variant.isAvailable')}</span>
          </label>

          <div className="form-field form-field-wide">
            <span className="form-field-label">{t('products.detail.variant.optionsLabel')}</span>
            <VariantOptionsEditor
              options={variant.options}
              onChange={(opts) => updateField('options', opts)}
              disabled={disabled}
            />
          </div>

          <div className="form-field form-field-wide">
            <span className="form-field-label">
              {hasColor
                ? t('products.detail.variant.colorGalleryLabelWithValue', { color: colorValue })
                : t('products.detail.variant.colorGalleryLabel')}
            </span>
            <p className="detail-section-desc mt-0 mb-2">
              {hasColor
                ? t('products.detail.variant.colorGalleryHintWithColor')
                : t('products.detail.variant.colorGalleryHintNoColor')}
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
  const { t } = useTranslation()
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
        const applyColorChange = () => {
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
        }
        const hasData = hasGalleryImages(current.gallery) || String(current.imageUrl || '').trim()
        if (hasData) {
          showConfirm(
            t('products.detail.variant.changeColorConfirm'),
            t('products.detail.variant.changeColorTitle'),
          ).then((confirmed) => { if (confirmed) applyColorChange() })
          return
        }
        applyColorChange()
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
      name: original.name ? t('products.detail.variant.copySuffixTemplate', { name: original.name }) : '',
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
    const label = variant.name.trim() || t('products.detail.variant.defaultLabel', { index: idx + 1 })
    const confirmed = await showConfirm(
      t('products.detail.variant.removeConfirm', { label }),
      t('products.detail.variant.remove'),
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
            placeholder={t('products.detail.variant.filterPlaceholder', { count: items.length })}
            disabled={disabled}
            aria-label={t('products.detail.variant.filterAria')}
           />
        )}
        {showFilter && filterTerm && (
          <span className="variants-filter-status">
            {t('products.detail.variant.filterMatch', { visible: visible.length, total: items.length })}
          </span>
        )}
        {!disabled && onOpenMatrixWizard && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMatrixWizard}
            title={t('products.detail.variant.generateMatrixTitle')}
          >
            ⊞ {t('products.detail.variant.generateMatrix')}
          </Button>
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
        <p className="variants-empty">{t('products.detail.variant.filterEmpty', { filter })}</p>
      )}

      <Button variant="outline" size="sm" onClick={addVariant} disabled={disabled}>
        + {t('products.detail.variant.addVariant')}
      </Button>
    </div>
  )
}

// ── Draft recovery banner ──────────────────────────────────────────────────────

function DraftRecoveryBanner({ ts, onRestore, onDiscard }) {
  const { t } = useTranslation()
  return (
    <div className="draft-recovery-banner">
      <span>{t('products.detail.draftRecovery.found', { time: formatDateTime(new Date(ts).toISOString()) })}</span>
      <div className="draft-recovery-actions">
        <Button size="sm" onClick={onRestore}>{t('products.detail.draftRecovery.restore')}</Button>
        <Button variant="outline" size="sm" onClick={onDiscard}>{t('products.detail.draftRecovery.discard')}</Button>
      </div>
    </div>
  )
}

// ── Publish quality checklist modal ───────────────────────────────────────────

function PublishChecklistModal({ form, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const items = getPublishReadiness(form, t)
  const blockers = items.filter((i) => !i.ok && i.required)
  const warnings = items.filter((i) => !i.ok && !i.required)

  return (
    <Modal
      open
      title={t('products.detail.checklist.title')}
      onClose={onCancel}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>{t('products.detail.checklist.backToEdit')}</Button>
          {blockers.length === 0 && (
            <Button type="button" size="sm" onClick={onConfirm}>{t('products.detail.checklist.publishNow')}</Button>
          )}
        </>
      }
    >
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
          {t('products.detail.checklist.blockerMessage', { count: blockers.length })}
        </p>
      )}
      {blockers.length === 0 && warnings.length > 0 && (
        <p className="modal-note modal-note--warn">
          {t('products.detail.checklist.warningMessage', { count: warnings.length })}
        </p>
      )}
    </Modal>
  )
}

// ── Variant matrix wizard ──────────────────────────────────────────────────────

function VariantMatrixWizard({ onGenerate, onClose }) {
  const { t } = useTranslation()
  const [attributes, setAttributes] = useState([
    { name: t('products.detail.matrix.defaultColor'), values: '' },
    { name: t('products.detail.matrix.defaultSize'), values: '' },
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

  const MATRIX_HARD_CAP = 200

  function generate() {
    if (!parsed.length) return
    if (estimatedCount > MATRIX_HARD_CAP) return
    const combos = cartesian(parsed.map((a) => a.values.map((v) => ({ name: a.name, value: v }))))
    const newVariants = combos.map((combo) => ({
      _key: crypto.randomUUID(),
      id: '',
      sku: '',
      name: combo.map((o) => o.value).join(' - '),
      imageUrl: '',
      isAvailable: true,
      options: combo.map((o) => ({ name: o.name, value: o.value })),
      gallery: [],
    }))
    onGenerate(newVariants)
    onClose()
  }

  return (
    <Modal
      open
      wide
      title={t('products.detail.matrix.title')}
      onClose={onClose}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="button" size="sm" onClick={generate} disabled={estimatedCount === 0 || estimatedCount > MATRIX_HARD_CAP}>
            {t('products.detail.matrix.generateButton', { count: estimatedCount })}
          </Button>
        </>
      }
    >
        <p className="detail-section-desc mb-4">
          {t('products.detail.matrix.description')}
        </p>

        <div className="wizard-attrs">
          {attributes.map((attr, i) => (
            <div key={i} className="wizard-attr-row">
              <Input
                placeholder={t('products.detail.matrix.attributePlaceholder')}
                value={attr.name}
                onChange={(e) => updateAttr(i, 'name', e.target.value)}
               />
              <Input className="wizard-attr-values"
                placeholder={t('products.detail.matrix.valuesPlaceholder')}
                value={attr.values}
                onChange={(e) => updateAttr(i, 'values', e.target.value)}
               />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => removeAttr(i)}
                disabled={attributes.length <= 1}
                aria-label={t('products.detail.variant.removeOption')}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={addAttr}
          disabled={attributes.length >= 5}
          className="mt-2"
        >
          + {t('products.detail.variant.addOption')}
        </Button>

        {estimatedCount > 0 && (
          <p className={`wizard-estimate${estimatedCount > MATRIX_HARD_CAP ? ' wizard-estimate--error' : estimatedCount > 50 ? ' wizard-estimate--warn' : ''}`}>
            {estimatedCount > MATRIX_HARD_CAP
              ? t('products.detail.matrix.estimateHardCap', { count: estimatedCount, cap: MATRIX_HARD_CAP })
              : estimatedCount > 50
                ? t('products.detail.matrix.estimateWarn', { count: estimatedCount })
                : t('products.detail.matrix.estimate', { count: estimatedCount })}
          </p>
        )}

    </Modal>
  )
}

// ── Prototype form layout ───────────────────────────────────────────────────────

// The 12 sections that map to real backend fields. The prototype's trust-badge /
// CTA sections stay dropped — BigBike's backend has no fields for them — but
// installation guide and FAQ have backing columns (V133) and related products
// have a curated join table (V135).
// `required` sections must be complete before the product can be published.
const SECTION_DEFS = [
  { id: 'section-basic',          key: 'basic',         icon: 'Info',       labelKey: 'products.detail.sectionBasic',         required: true  },
  { id: 'section-pricing',        key: 'pricing',       icon: 'Tag',        labelKey: 'products.detail.sectionPricing',       required: true  },
  { id: 'section-media',          key: 'media',         icon: 'Image',      labelKey: 'products.detail.mainImageTitle',       required: true  },
  { id: 'section-seo',            key: 'seo',           icon: 'Search',     labelKey: 'products.detail.sectionSeo',           required: false },
  { id: 'section-content-bottom', key: 'contentBottom', icon: 'LayoutList', labelKey: 'products.detail.sectionContentBottom', required: false },
  { id: 'section-gallery',        key: 'gallery',       icon: 'Images',     labelKey: 'products.detail.gallerySectionTitle',  required: false },
  { id: 'section-videos',         key: 'videos',        icon: 'Video',      labelKey: 'products.detail.videoSectionTitle',    required: false },
  { id: 'section-specs',          key: 'specs',         icon: 'ListChecks', labelKey: 'products.detail.specsSectionTitle',     required: false },
  { id: 'section-installation',   key: 'installation',  icon: 'Wrench',     labelKey: 'products.detail.sectionInstallation',   required: false },
  { id: 'section-faqs',           key: 'faqs',          icon: 'HelpCircle', labelKey: 'products.detail.sectionFaqs',           required: false },
  { id: 'section-variants',       key: 'variants',      icon: 'Layers',     labelKey: 'products.detail.variantSectionTitle',   required: false },
  { id: 'section-related',        key: 'related',       icon: 'Link2',      labelKey: 'products.detail.sectionRelated',        required: false },
]

// Group sections into 4 fixed tabs — keys must match SECTION_DEFS keys.
// `general` holds the three required sections so users can publish from a single tab.
const TAB_SECTIONS = {
  general:  ['basic', 'pricing', 'media'],
  content:  ['seo', 'contentBottom', 'gallery', 'videos'],
  details:  ['specs', 'installation', 'faqs'],
  variants: ['variants', 'related'],
}

// Field-prefix groups by section key — single source of truth used by both the
// in-render sectionErrors derivation and the synchronous save-time tab switch.
const SECTION_FIELD_PREFIXES = {
  basic:         ['name','slug','sku','shortDescription','description','brandId','categoryId','publishStatus'],
  pricing:       ['retailPrice','compareAtPrice','salePrice'],
  media:         ['imageUrl'],
  seo:           ['seoTitle','seoDescription','seoCanonicalUrl','seoOgImageUrl','seoOgImageAlt'],
  contentBottom: ['contentBottom'],
  gallery:       ['gallery'],
  videos:        ['videos'],
  specs:         ['specifications'],
  installation:  ['installationGuide'],
  faqs:          ['faqs'],
  variants:      ['variants'],
  related:       ['relatedProductIds'],
}

function computeSectionErrorsFromMap(errors) {
  const keys = Object.keys(errors)
  const result = {}
  for (const [section, prefixes] of Object.entries(SECTION_FIELD_PREFIXES)) {
    result[section] = prefixes.some((p) => keys.some((k) => k === p || k.startsWith(p + '.')))
  }
  return result
}

// Find the first tab containing any failing section for the given errors map.
function findTabForErrors(sectionErrors) {
  for (const [tab, keys] of Object.entries(TAB_SECTIONS)) {
    if (keys.some((k) => sectionErrors[k])) return tab
  }
  return null
}

// Map publishStatus → matching .badge variant. Used in ScreenHeader.
function publishBadgeClass(status) {
  switch (status) {
    case 'PUBLISHED': return 'badge badge-success'
    case 'DRAFT':     return 'badge badge-neutral'
    case 'HIDDEN':    return 'badge badge-orange'
    case 'TRASH':     return 'badge badge-danger'
    default:          return 'badge badge-neutral'
  }
}

// Pill badge showing which team role owns a section.
function RoleBadge({ role }) {
  const { t } = useTranslation()
  if (role === 'content') {
    const label = t('products.detail.assign.roleContent', { defaultValue: 'Content' })
    return (
      <span
        className="inline-flex items-center text-[10px] uppercase tracking-wide px-1.5 py-0.5 border rounded-none"
        style={{ color: 'var(--admin-color-brand-red)', borderColor: 'var(--admin-color-brand-red)' }}
      >{label}</span>
    )
  }
  if (role === 'seo') {
    const label = t('products.detail.assign.roleSeo', { defaultValue: 'SEO' })
    return (
      <span
        className="inline-flex items-center text-[10px] uppercase tracking-wide px-1.5 py-0.5 border rounded-none"
        style={{ color: 'var(--admin-color-status-warning-text)', borderColor: 'var(--admin-color-status-warning-text)' }}
      >{label}</span>
    )
  }
  if (role === 'manager') {
    const label = t('products.detail.assign.roleManager', { defaultValue: 'Quản lý' })
    return (
      <span
        className="inline-flex items-center text-[10px] uppercase tracking-wide px-1.5 py-0.5 border rounded-none"
        style={{ color: 'var(--admin-color-text-primary)', borderColor: 'var(--admin-color-text-primary)' }}
      >{label}</span>
    )
  }
  return null
}

// Section card wrapper — matches CategoryDetail/BrandDetail "card-head + card-body" pattern.
// Required sections get a subtle red asterisk after the title instead of a loud "BẮT BUỘC" badge.
function SectionCard({ title, badge, required, children }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>
          {title}
          {required && (
            <span
              className="ml-1 text-[var(--admin-color-brand-red)]"
              aria-label="bắt buộc"
              title="Bắt buộc"
            >*</span>
          )}
        </h2>
        {badge}
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

// Field shell — pass `full` to span both grid columns.
function Field({ label, hint, error, count, countWarn, full, children }) {
  return (
    <div className={cn('flex flex-col gap-1.5', full && 'md:col-span-2')}>
      {(label || count != null) && (
        <div className="flex justify-between items-baseline text-sm font-medium text-foreground/80">
          {label && <span>{label}</span>}
          {count != null && (
            <span
              className={cn(
                'text-xs tabular-nums text-muted-foreground',
                countWarn && 'text-[var(--admin-color-status-warning-text)] font-semibold',
              )}
            >
              {count}
            </span>
          )}
        </div>
      )}
      {children}
      {error
        ? <span className="text-xs text-[var(--admin-color-status-danger-text)] font-semibold">{error}</span>
        : hint
          ? <span className="text-xs text-muted-foreground">{hint}</span>
          : null}
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
  // Content language being edited (V136). Independent of the admin UI language
  // (i18n) — it only switches which language the text fields read/write.
  const [contentLang, setContentLang] = useState('vi')
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

  // Product picker for the "Sản phẩm liên quan" section — debounced search,
  // self excluded so a product can't be added to its own related list.
  const [relatedSearch, setRelatedSearch] = useState('')
  const [relatedSearchDebounced, setRelatedSearchDebounced] = useState('')
  useEffect(() => {
    const handle = setTimeout(() => setRelatedSearchDebounced(relatedSearch.trim()), 300)
    return () => clearTimeout(handle)
  }, [relatedSearch])

  const { data: relatedSearchResult, isFetching: isSearchingRelated } = useQuery({
    queryKey: ['product-related-search', relatedSearchDebounced],
    queryFn: () => fetchProducts({ q: relatedSearchDebounced, pageSize: 8 }),
    enabled: relatedSearchDebounced.length >= 1,
    staleTime: 60 * 1000,
  })
  const relatedSearchItems = (relatedSearchResult?.items ?? []).filter((p) => p.id !== productId)

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
          homepageBlock: 'NONE',
          homepageOrder: '',
          // Clear variants IDs so they create as new
          variants: base.variants.map((v) => ({ ...v, _key: crypto.randomUUID(), id: '' })),
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm(duplicated)
        setIsDirty(true)
        slugEditedByUser.current = false
        toast.success(t('products.detail.duplicateSuccess', { name: item.name || t('products.detail.productFallbackName') }))
        return
      }
    } catch { /* ignore parse errors */ }

    const draft = loadFormFromStorage(autosaveKey)
    if (draft?.form) setDraftRecovery(draft)
  }, [autosaveKey, isCreate, t])

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

  // Write one English product-level field (V136). Vietnamese stays on form[field].
  function updateTranslation(field, value) {
    setForm((previous) => ({
      ...previous,
      translations: {
        ...previous.translations,
        en: { ...(previous.translations?.en || {}), [field]: value },
      },
    }))
    setIsDirty(true)
  }

  const isEnLang = contentLang === 'en'

  // Value of a translatable product-level text field for the active language.
  function langValue(field) {
    return isEnLang ? (form.translations?.en?.[field] ?? '') : (form[field] ?? '')
  }

  // Write a translatable product-level text field into the active language.
  function langChange(field, value) {
    if (isEnLang) updateTranslation(field, value)
    else updateField(field, value)
  }

  function addRelatedProduct(product) {
    if (!product?.id) return
    setForm((previous) => {
      if (previous.relatedProductIds.includes(product.id)) return previous
      return {
        ...previous,
        relatedProductIds: [...previous.relatedProductIds, product.id],
        relatedProductChips: [
          ...previous.relatedProductChips,
          {
            id: product.id,
            name: product.name || product.id,
            slug: product.slug || '',
            imageUrl: product.image?.url || '',
          },
        ],
      }
    })
    setIsDirty(true)
    setRelatedSearch('')
    setRelatedSearchDebounced('')
  }

  function removeRelatedProduct(removeId) {
    setForm((previous) => ({
      ...previous,
      relatedProductIds: previous.relatedProductIds.filter((id) => id !== removeId),
      relatedProductChips: previous.relatedProductChips.filter((chip) => chip.id !== removeId),
    }))
    setIsDirty(true)
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
      // Briefly flash the "saved" dot in the TOC save bar.
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1200)
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
      const errorEl = formRef.current?.querySelector('.field-error')
      if (!errorEl) return
      const container = errorEl.closest('label, .form-field')
      // Try native focusable inputs first, then fall back to combobox (shadcn
      // Select) or contenteditable (RichTextEditor) — both of which querySelector
      // 'input, select, textarea' misses.
      const focusTarget =
        container?.querySelector('input, textarea, [contenteditable="true"], [role="combobox"]') ??
        errorEl
      if (typeof focusTarget.focus === 'function') {
        focusTarget.focus()
      } else {
        errorEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
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
      // Switch to the first tab containing an error so the user sees the field
      // we're about to focus. computeSectionErrorsFromMap reuses the same
      // prefix logic used by sectionErrors below.
      const failedTab = findTabForErrors(computeSectionErrorsFromMap(clientErrors))
      if (failedTab && failedTab !== activeTab) setActiveTab(failedTab)
      focusFirstError()
      return
    }

    // Show quality checklist whenever the resulting status would be PUBLISHED
    // but the saved-on-server status is not — covers both the "Save & Publish"
    // button path AND the dropdown-then-save path.
    if (originalPublishStatus !== 'PUBLISHED' && formToSave.publishStatus === 'PUBLISHED') {
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

  // ── Tab navigation state (replaces the old TOC sidebar) ─────────────────────
  const [activeTab, setActiveTab] = useState('general')
  const [savedFlash, setSavedFlash] = useState(false)

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

  const sectionErrors = computeSectionErrorsFromMap(validationErrors)
  const tabCounts = Object.fromEntries(
    Object.entries(TAB_SECTIONS).map(([tab, keys]) => [tab, keys.filter((k) => sectionErrors[k]).length]),
  )

  // SEO checklist — same heuristics as the prototype, computed from real fields.
  const seoChecks = [
    { ok: !!form.seoTitle && form.seoTitle.length >= 30 && form.seoTitle.length <= 60, label: t('products.detail.seoCheckTitle', { defaultValue: 'Title Tag 30–60 ký tự' }) },
    { ok: !!form.seoDescription && form.seoDescription.length >= 140 && form.seoDescription.length <= 160, label: t('products.detail.seoCheckDesc', { defaultValue: 'Meta Description 140–160 ký tự' }) },
    { ok: /\d/.test(form.seoDescription || ''), label: t('products.detail.seoCheckPrice', { defaultValue: 'Meta có giá (con số)' }) },
    { ok: /bảo hành|warranty/i.test(form.seoDescription || ''), label: t('products.detail.seoCheckWarranty', { defaultValue: 'Meta có "bảo hành"' }) },
    { ok: !!form.slug && /^[a-z0-9-]+$/.test(form.slug), label: t('products.detail.seoCheckSlug', { defaultValue: 'Slug chữ thường, không dấu, dùng "-"' }) },
    { ok: !!form.imageUrl && !!form.imageAlt, label: t('products.detail.seoCheckImageAlt', { defaultValue: 'Ảnh đại diện có alt text' }) },
    { ok: !!form.seoOgImageUrl, label: t('products.detail.seoCheckOg', { defaultValue: 'OG image cho chia sẻ MXH' }) },
    { ok: true, label: t('products.detail.seoCheckSchema', { defaultValue: 'Schema Product (tự động)' }) },
  ]
  const seoPassed = seoChecks.filter((c) => c.ok).length

  // ── Save-bar derivations ────────────────────────────────────────────────────
  const saveDotState = isSubmitting ? 'saving' : savedFlash ? 'saved-flash' : isDirty ? 'dirty' : 'saved'
  const saveDotClass =
    saveDotState === 'saving'      ? 'bg-[var(--admin-color-status-info-text)] animate-pulse'
    : saveDotState === 'dirty'     ? 'bg-[var(--admin-color-status-warning-text)] animate-pulse'
    :                                'bg-[var(--admin-color-status-success-text)]'
  const saveLabel = isSubmitting
    ? t('products.detail.savingShort', { defaultValue: 'Đang lưu...' })
    : isDirty
      ? t('products.detail.saveDirty', { defaultValue: 'Có thay đổi chưa lưu' })
      : t('products.detail.saveClean', { defaultValue: 'Đã lưu' })

  const isPublished = form.publishStatus === 'PUBLISHED'
  const primaryLabel = isPublished
    ? t('products.detail.saveBtn')
    : (isCreate ? t('products.detail.createAndPublish') : t('products.detail.saveAndPublish'))

  async function handleClose() {
    if (isDirty) {
      const confirmed = await showConfirm(
        t('products.detail.unsavedChangesConfirm'),
        t('products.detail.unsavedChangesTitle'),
      )
      if (!confirmed) return
    }
    navigate('/admin/products')
  }

  return (
    <div className="bb-proto">
      <Screen maxWidth="1200px">
        <ScreenHeader
          eyebrow={t('products.detail.eyebrow')}
          title={isCreate
            ? t('products.detail.createTitle')
            : (langValue('name') || form.name || t('products.detail.editTitle'))}
          description={
            !isCreate && state.item?.updatedAt ? (
              <span className="text-xs">
                {t('common.lastUpdated')} {formatDateTime(state.item.updatedAt)}
                {isEnLang && (
                  <>
                    {' · '}
                    {t('products.detail.langEnHint', {
                      defaultValue: 'Bản tiếng Anh không bắt buộc',
                    })}
                  </>
                )}
              </span>
            ) : isEnLang ? (
              <span className="text-xs">
                {t('products.detail.langEnHint', {
                  defaultValue: 'Bản tiếng Anh không bắt buộc',
                })}
              </span>
            ) : null
          }
          badge={
            <span className="inline-flex items-center gap-2">
              <span className={publishBadgeClass(form.publishStatus)}>
                {t(`status.publish.${form.publishStatus}`, { defaultValue: form.publishStatus })}
              </span>
              {isReadOnly && (
                <span className="badge badge-warn">
                  <Lock size={11} />
                  {t('products.detail.readOnlyBadge', { defaultValue: 'Chỉ đọc' })}
                </span>
              )}
            </span>
          }
          actions={
            <div className="flex items-center gap-3">
              <Tabs
                ariaLabel={t('products.detail.contentLanguageAriaLabel', { defaultValue: 'Ngôn ngữ nội dung' })}
                value={contentLang}
                onChange={setContentLang}
                items={[
                  { key: 'vi', label: 'VI' },
                  { key: 'en', label: 'EN' },
                ]}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('products.detail.assign.title', { defaultValue: 'Phân công' })}
                    title={t('products.detail.assign.title', { defaultValue: 'Phân công' })}
                  >
                    <Users size={18} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold uppercase tracking-wide">
                    <Users size={14} />
                    <span>{t('products.detail.assign.title', { defaultValue: 'Phân công' })}</span>
                  </div>
                  <div className="space-y-2 text-xs leading-relaxed">
                    <div className="border-l-[3px] pl-2 py-1 border-[var(--admin-color-brand-red)]">
                      <strong className="text-foreground">{t('products.detail.assign.roleContent', { defaultValue: 'Content' })}: </strong>
                      <span className="text-muted-foreground">
                        {t('products.detail.assign.itemsContent', {
                          defaultValue: 'Thông tin cơ bản · Ảnh đại diện · Bộ sưu tập ảnh · Video · Thông số kỹ thuật · Hướng dẫn lắp đặt · Câu hỏi thường gặp · Biến thể · Sản phẩm liên quan · Nội dung SEO dưới',
                        })}
                      </span>
                    </div>
                    <div className="border-l-[3px] pl-2 py-1 border-[var(--admin-color-status-warning-text)]">
                      <strong className="text-foreground">{t('products.detail.assign.roleSeo', { defaultValue: 'SEO' })}: </strong>
                      <span className="text-muted-foreground">
                        {t('products.detail.assign.itemsSeo', {
                          defaultValue: 'Thông tin SEO (Title, Meta, OG image) · Đường dẫn (slug) · Kiểm tra checklist trước khi đăng',
                        })}
                      </span>
                    </div>
                    <div className="border-l-[3px] pl-2 py-1 border-[var(--admin-color-text-primary)]">
                      <strong className="text-foreground">{t('products.detail.assign.roleManager', { defaultValue: 'Quản lý' })}: </strong>
                      <span className="text-muted-foreground">
                        {t('products.detail.assign.itemsManager', {
                          defaultValue: 'Giá & trạng thái · Duyệt đăng sản phẩm',
                        })}
                      </span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                aria-label={t('common.cancel')}
                data-screen-close="true"
              >
                <X size={18} />
              </Button>
            </div>
          }
        />

        {/* Banners — read-only / draft-recovery / mock-warning */}
        {!canUpdate && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-color-status-warning-bg)] border border-[var(--admin-color-status-warning-border)] text-[var(--admin-color-status-warning-text)] text-sm">
            <Lock size={16} />
            <span>{t('products.detail.permissionDesc')}</span>
          </div>
        )}

        {state.warning && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-color-status-warning-bg)] border border-[var(--admin-color-status-warning-border)] text-[var(--admin-color-status-warning-text)] text-sm">
            <AlertCircle size={16} />
            <div className="flex-1">{state.warning}</div>
          </div>
        )}

        {draftRecovery && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-[var(--admin-color-status-info-bg)] border border-[var(--admin-color-status-info-border)] text-[var(--admin-color-status-info-text)] text-xs">
            <Save size={14} className="shrink-0" />
            <span className="flex-1 truncate">
              <strong>{t('products.detail.draftFoundShort', { defaultValue: 'Có bản nháp tạm' })}</strong>
              {' · '}{formatDateTime(new Date(draftRecovery.ts).toISOString())}
            </span>
            <button
              type="button"
              className="text-xs font-semibold underline hover:no-underline"
              onClick={() => {
                setForm(draftRecovery.form)
                setIsDirty(true)
                setDraftRecovery(null)
                slugEditedByUser.current = Boolean(draftRecovery.form.slug)
              }}
            >
              {t('products.detail.draftRestore', { defaultValue: 'Khôi phục' })}
            </button>
            <button
              type="button"
              className="text-xs opacity-70 hover:opacity-100"
              onClick={() => { clearFormFromStorage(autosaveKey); setDraftRecovery(null) }}
            >
              {t('products.detail.draftDiscard', { defaultValue: 'Bỏ qua' })}
            </button>
          </div>
        )}

        <Tabs
          ariaLabel={t('products.detail.tabsAriaLabel', { defaultValue: 'Phần của sản phẩm' })}
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'general',  label: t('products.detail.tabGeneral'),  count: tabCounts.general  || undefined },
            { key: 'content',  label: t('products.detail.tabContent'),  count: tabCounts.content  || undefined },
            { key: 'details',  label: t('products.detail.tabDetails'),  count: tabCounts.details  || undefined },
            { key: 'variants', label: t('products.detail.tabVariants'), count: tabCounts.variants || undefined },
          ]}
        />

        <form
          ref={formRef}
          className="flex flex-col gap-6 pb-4"
          onSubmit={(e) => { e.preventDefault(); handleSave() }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
              e.preventDefault()
              handleSave()
            }
          }}
        >
          {activeTab === 'general' && (
            <>
              {/* ── Card: Thông tin cơ bản ── */}
              <SectionCard
                title={t('products.detail.sectionBasic')}
                required
                badge={
                  <div className="flex items-center gap-1.5">
                    <RoleBadge role="content" />
                    <RoleBadge role="seo" />
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    full
                    label={t('products.detail.name')}
                    count={`${langValue('name').length} / 255`}
                    countWarn={langValue('name').length > 230}
                    error={validationErrors.name}
                  >
                    <Input
                      value={langValue('name')}
                      onChange={(e) => (isEnLang ? updateTranslation('name', e.target.value) : handleNameChange(e.target.value))}
                      disabled={isReadOnly}
                      maxLength={255}
                    />
                  </Field>

                  <Field
                    full
                    label={t('products.detail.slug')}
                    error={validationErrors.slug}
                    hint={isEnLang
                      ? t('products.detail.slugSharedHint', { defaultValue: 'Đường dẫn dùng chung cho cả hai ngôn ngữ — chỉ sửa được ở tab Tiếng Việt.' })
                      : t('products.detail.slugHint')}
                  >
                    <Input
                      value={form.slug}
                      placeholder="vd: mu-bao-hiem-fullface-agv-k1s"
                      onChange={(e) => handleSlugChange(e.target.value)}
                      onBlur={(e) => handleSlugBlur(e.target.value)}
                      disabled={isReadOnly || isEnLang}
                      maxLength={200}
                      className="font-mono"
                    />
                  </Field>

                  <Field
                    label={t('products.detail.sku')}
                    count={`${form.sku.length} / 100`}
                    countWarn={form.sku.length > 85}
                    hint={t('products.detail.skuHint')}
                  >
                    <Input
                      value={form.sku}
                      onChange={(e) => updateField('sku', e.target.value)}
                      disabled={isReadOnly}
                      maxLength={100}
                      className="font-mono"
                    />
                  </Field>

                  <Field label={t('products.detail.categoryId')} error={validationErrors.categoryId}>
                    <Select value={form.categoryId} onValueChange={(val) => updateField('categoryId', val)} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {form.categoryId && !categories.some((c) => c.id === form.categoryId) && (
                          <SelectItem value={form.categoryId} disabled>{t('products.detail.optionNotFound', { id: form.categoryId })}</SelectItem>
                        )}
                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label={t('products.detail.brandId')}>
                    <Select value={form.brandId} onValueChange={(val) => updateField('brandId', val)} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {form.brandId && !brands.some((b) => b.id === form.brandId) && (
                          <SelectItem value={form.brandId} disabled>{t('products.detail.optionNotFound', { id: form.brandId })}</SelectItem>
                        )}
                        {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    full
                    label={t('products.detail.shortDescription')}
                    count={`${langValue('shortDescription').length} / 500`}
                    countWarn={langValue('shortDescription').length > 450}
                    hint={t('products.detail.shortDescriptionHint')}
                    error={validationErrors.shortDescription}
                  >
                    <Textarea
                      className={validationErrors.shortDescription ? 'border-danger' : undefined}
                      value={langValue('shortDescription')}
                      onChange={(e) => langChange('shortDescription', e.target.value)}
                      maxLength={500}
                      placeholder={t('products.detail.shortDescriptionPlaceholder')}
                      disabled={isReadOnly}
                    />
                  </Field>

                  <Field full label={t('products.detail.description')} error={validationErrors.description}>
                    {isEnLang ? (
                      <RichTextEditor
                        key="description-en"
                        value={langValue('description')}
                        onChange={(html) => langChange('description', html)}
                        placeholder={t('products.detail.descriptionPlaceholder')}
                        disabled={isReadOnly}
                        hasError={Boolean(validationErrors.description)}
                        enableImagePicker
                      />
                    ) : (
                      <BlockEditor
                        value={form.descriptionBlocks}
                        onChange={(blocks) => updateField('descriptionBlocks', blocks)}
                        disabled={isReadOnly}
                        hasError={Boolean(validationErrors.description)}
                        fallbackHtml={form.description}
                      />
                    )}
                  </Field>

                  <Field
                    full
                    label={t('products.detail.promotionContent')}
                    hint={t('products.detail.promotionContentHint')}
                    error={validationErrors.promotionContent}
                  >
                    <RichTextEditor
                      key={`promotionContent-${contentLang}`}
                      value={langValue('promotionContent')}
                      onChange={(html) => langChange('promotionContent', html)}
                      placeholder={t('products.detail.promotionContentPlaceholder')}
                      disabled={isReadOnly}
                      hasError={Boolean(validationErrors.promotionContent)}
                      enableImagePicker
                    />
                  </Field>

                  <Field full label={t('products.detail.homepageBlock')} hint={t('products.detail.homepageHint')}>
                    <Select value={form.homepageBlock || 'NONE'} onValueChange={(val) => updateField('homepageBlock', val)} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">{t('products.detail.homepageNone')}</SelectItem>
                        <SelectItem value="FEATURED_GRID">{t('products.detail.homepageFeaturedGrid')}</SelectItem>
                        <SelectItem value="RECOMMENDED_CAROUSEL">{t('products.detail.homepageRecommendedCarousel')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.homepageBlock && form.homepageBlock !== 'NONE' && form.publishStatus !== 'PUBLISHED' && (
                      <span className="text-xs text-[var(--admin-color-status-warning-text)] font-semibold">
                        {t('products.detail.homepagePublishWarning')}
                      </span>
                    )}
                  </Field>

                  {form.homepageBlock && form.homepageBlock !== 'NONE' && (
                    <Field label={t('products.detail.homepageOrder')} hint={t('products.detail.homepageOrderHint')}>
                      <Input
                        type="number"
                        inputMode="numeric"
                        step={1}
                        min={0}
                        value={form.homepageOrder}
                        onChange={(e) => updateField('homepageOrder', e.target.value)}
                        placeholder={t('products.detail.homepageOrderPlaceholder')}
                        disabled={isReadOnly}
                      />
                    </Field>
                  )}
                </div>
              </SectionCard>

              {/* ── Card: Giá & trạng thái ── */}
              <SectionCard title={t('products.detail.sectionPricing')} required badge={<RoleBadge role="manager" />}>
                {form.variants.length > 0 && (
                  <div className="flex items-start gap-2 mb-4 p-3 bg-[var(--admin-color-status-info-bg)] border border-[var(--admin-color-status-info-border)] text-[var(--admin-color-status-info-text)] text-sm">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>{t('products.detail.variantPricingHint')}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t('products.detail.retailPrice')} error={validationErrors.retailPrice}>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="vd: 5.900.000"
                      value={formatPrice(form.retailPrice)}
                      onChange={(e) => updateField('retailPrice', e.target.value.replace(/\D/g, ''))}
                      disabled={isReadOnly}
                    />
                  </Field>

                  <Field
                    label={<span title={t('products.detail.compareAtPriceTitle')}>{t('products.detail.compareAtPriceLabel')}</span>}
                    error={validationErrors.compareAtPrice}
                  >
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="vd: 6.500.000"
                      value={formatPrice(form.compareAtPrice)}
                      onChange={(e) => updateField('compareAtPrice', e.target.value.replace(/\D/g, ''))}
                      disabled={isReadOnly}
                    />
                  </Field>

                  <Field
                    label={t('products.detail.salePrice')}
                    error={
                      validationErrors.salePrice
                        ? validationErrors.salePrice
                        : form.salePrice && form.retailPrice && Number(form.salePrice) >= Number(form.retailPrice)
                          ? t('products.detail.saleMustBeLower')
                          : undefined
                    }
                  >
                    <div className="flex gap-2">
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
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => setShowDiscountHelper((p) => !p)}
                          title={t('products.detail.discountButtonTitle')}
                        >
                          {t('products.detail.discountButton')}
                        </Button>
                      )}
                    </div>
                    {showDiscountHelper && !isReadOnly && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 p-2 bg-muted">
                        <Input
                          type="number"
                          min="1"
                          max="99"
                          placeholder={t('products.detail.discountInputPlaceholder')}
                          value={discountPct}
                          onChange={(e) => setDiscountPct(e.target.value)}
                          className="w-32"
                        />
                        <Button
                          size="sm"
                          type="button"
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
                          {t('products.detail.apply')}
                        </Button>
                        <small className="text-xs text-muted-foreground">
                          {(Number(form.retailPrice) || Number(form.compareAtPrice))
                            ? t('products.detail.discountFromBaseHint')
                            : t('products.detail.discountNeedsBaseHint')}
                        </small>
                      </div>
                    )}
                  </Field>

                  <Field label={t('products.detail.publishStatus')} error={validationErrors.publishStatus}>
                    <Select value={form.publishStatus} onValueChange={(val) => updateField('publishStatus', val)} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {form.publishStatus && !['DRAFT', 'PUBLISHED', 'HIDDEN', 'TRASH'].includes(form.publishStatus) && (
                          <SelectItem value={form.publishStatus} disabled>
                            {t('products.detail.specialPublishNote', { state: form.publishStatus })}
                          </SelectItem>
                        )}
                        <SelectItem value="DRAFT" disabled={!allowedPublishStatuses.includes('DRAFT')}>{t('status.publish.DRAFT')}</SelectItem>
                        <SelectItem value="PUBLISHED" disabled={!allowedPublishStatuses.includes('PUBLISHED')}>{t('status.publish.PUBLISHED')}</SelectItem>
                        <SelectItem value="HIDDEN" disabled={!allowedPublishStatuses.includes('HIDDEN')}>{t('status.publish.HIDDEN')}</SelectItem>
                        {form.publishStatus === 'TRASH' && (
                          <SelectItem value="TRASH" disabled>{t('status.publish.TRASH')}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </Field>

                  <label className="md:col-span-2 flex items-start gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted">
                    <Checkbox
                      checked={form.forceOutOfStock}
                      onCheckedChange={(checked) => updateField('forceOutOfStock', checked)}
                      disabled={isReadOnly}
                    />
                    <span><strong>{t('products.detail.forceOutOfStock')}</strong> — {t('products.detail.forceOutOfStockHint')}</span>
                  </label>
                </div>
              </SectionCard>

              {/* ── Card: Ảnh đại diện ── */}
              <SectionCard title={t('products.detail.mainImageTitle')} required badge={<RoleBadge role="content" />}>
                <ImageUrlInput
                  value={form.imageUrl}
                  onChange={(url) => updateField('imageUrl', url)}
                  alt={form.imageAlt}
                  onAltChange={(v) => updateField('imageAlt', v)}
                  disabled={isReadOnly}
                  error={validationErrors.imageUrl}
                />
              </SectionCard>
            </>
          )}

          {activeTab === 'content' && (
            <>
              {/* ── Card: SEO ── */}
              <SectionCard title={t('products.detail.sectionSeo')} badge={<RoleBadge role="seo" />}>
                {/* Live Google SERP preview */}
                <div className="mb-4 p-3 border border-border bg-white">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <PfSearch size={12} />
                    <span>{t('products.detail.serpPreview', { defaultValue: 'Xem trước trên Google' })}</span>
                  </div>
                  <div className="text-xs text-[#5f6368] break-all mb-1">
                    https://bigbike.vn
                    <span className="text-[#70757a]"> › sp › {form.slug || 'duong-dan-san-pham'}</span>
                  </div>
                  <div className="text-lg leading-snug text-[#1a0dab] break-words mb-1">
                    {(form.seoTitle || form.name || t('products.detail.serpTitleFallback', { defaultValue: 'Tiêu đề sản phẩm trên Google' })).slice(0, 60)}
                  </div>
                  <div className="text-sm leading-relaxed text-[#4d5156] break-words">
                    {form.seoDescription || form.shortDescription || t('products.detail.serpDescFallback', { defaultValue: 'Mô tả ngắn về sản phẩm sẽ hiển thị ở đây.' })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    full
                    label={t('products.detail.seoTitle')}
                    count={`${langValue('seoTitle').length} / 255`}
                    countWarn={langValue('seoTitle').length > 230}
                    error={validationErrors.seoTitle}
                  >
                    <Input
                      value={langValue('seoTitle')}
                      onChange={(e) => langChange('seoTitle', e.target.value)}
                      disabled={isReadOnly}
                      maxLength={255}
                      placeholder={t('products.detail.seoTitle')}
                    />
                  </Field>

                  <Field
                    full
                    label={t('products.detail.seoDescription')}
                    count={`${langValue('seoDescription').length} / 5000`}
                    countWarn={langValue('seoDescription').length > 4500}
                    error={validationErrors.seoDescription}
                  >
                    <Textarea
                      value={langValue('seoDescription')}
                      onChange={(e) => langChange('seoDescription', e.target.value)}
                      disabled={isReadOnly}
                      maxLength={5000}
                      placeholder={t('products.detail.seoDescription')}
                      className={validationErrors.seoDescription ? 'border-danger' : undefined}
                    />
                  </Field>

                  <Field full label={t('products.detail.seoCanonicalUrl')} error={validationErrors.seoCanonicalUrl}>
                    <Input
                      value={form.seoCanonicalUrl}
                      onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="https://..."
                      className={validationErrors.seoCanonicalUrl ? 'border-danger' : undefined}
                    />
                  </Field>

                  <Field full label={t('products.detail.seoOgImageUrl')} error={validationErrors.seoOgImageAlt}>
                    <ImageUrlInput
                      value={form.seoOgImageUrl}
                      onChange={(url) => updateField('seoOgImageUrl', url)}
                      alt={form.seoOgImageAlt}
                      onAltChange={(v) => updateField('seoOgImageAlt', v)}
                      disabled={isReadOnly}
                      error={validationErrors.seoOgImageUrl}
                    />
                  </Field>

                  <label className="md:col-span-2 flex items-start gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted">
                    <Checkbox
                      checked={form.seoNoIndex}
                      onCheckedChange={(checked) => updateField('seoNoIndex', checked)}
                      disabled={isReadOnly}
                    />
                    <span>{t('products.detail.seoNoIndex')}</span>
                  </label>
                </div>

                {/* SEO checklist */}
                <div className="mt-4 p-3 border border-border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <Check size={14} />
                      {t('products.detail.seoChecklist', { defaultValue: 'Checklist SEO' })}
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--admin-color-status-success-text)]">
                      {seoPassed} / {seoChecks.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-3">
                    {seoChecks.map((c, i) => (
                      <div key={i} className={cn('flex items-center gap-2 text-xs', c.ok ? 'text-foreground' : 'text-muted-foreground')}>
                        <span className={cn(
                          'w-4 h-4 flex items-center justify-center',
                          c.ok
                            ? 'bg-[var(--admin-color-status-success-bg)] text-[var(--admin-color-status-success-text)]'
                            : 'bg-muted',
                        )}>
                          {c.ok ? <Check size={11} /> : null}
                        </span>
                        <span>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              {/* ── Card: Nội dung dưới ── */}
              <SectionCard title={t('products.detail.sectionContentBottom')} badge={<RoleBadge role="content" />}>
                <RichTextEditor
                  key={`contentBottom-${contentLang}`}
                  value={langValue('contentBottom')}
                  onChange={(html) => langChange('contentBottom', html)}
                  placeholder={t('products.detail.contentBottom')}
                  disabled={isReadOnly}
                  hasError={Boolean(validationErrors.contentBottom)}
                  enableImagePicker
                />
                {validationErrors.contentBottom && (
                  <span className="text-xs text-[var(--admin-color-status-danger-text)] font-semibold mt-2 block">
                    {validationErrors.contentBottom}
                  </span>
                )}
              </SectionCard>

              {/* ── Card: Gallery ── */}
              <SectionCard
                title={t('products.detail.gallerySectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.gallery.length} {t('products.detail.galleryUnit', { defaultValue: 'ảnh' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <GalleryEditor
                  items={form.gallery}
                  onChange={(next) => updateField('gallery', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                />
              </SectionCard>

              {/* ── Card: Video ── */}
              <SectionCard
                title={t('products.detail.videoSectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.videos.length} video
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <VideoEditor
                  items={form.videos}
                  onChange={(next) => updateField('videos', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                />
              </SectionCard>
            </>
          )}

          {activeTab === 'details' && (
            <>
              {/* ── Card: Thông số ── */}
              <SectionCard
                title={t('products.detail.specsSectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.specifications.length} {t('products.detail.specUnit', { defaultValue: 'thông số' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <SpecificationsEditor
                  items={form.specifications}
                  onChange={(next) => updateField('specifications', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                  contentLang={contentLang}
                />
              </SectionCard>

              {/* ── Card: Hướng dẫn lắp đặt ── */}
              <SectionCard title={t('products.detail.sectionInstallation')} badge={<RoleBadge role="content" />}>
                <p className="text-xs text-muted-foreground mb-2">{t('products.detail.installationHint')}</p>
                <RichTextEditor
                  key={`installationGuide-${contentLang}`}
                  value={langValue('installationGuide')}
                  onChange={(html) => langChange('installationGuide', html)}
                  placeholder={t('products.detail.installationPlaceholder')}
                  disabled={isReadOnly}
                  hasError={Boolean(validationErrors.installationGuide)}
                  enableImagePicker
                />
                {validationErrors.installationGuide && (
                  <span className="text-xs text-[var(--admin-color-status-danger-text)] font-semibold mt-2 block">
                    {validationErrors.installationGuide}
                  </span>
                )}
              </SectionCard>

              {/* ── Card: FAQ ── */}
              <SectionCard
                title={t('products.detail.sectionFaqs')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.faqs.length} {t('products.detail.faqs.unit', { defaultValue: 'câu hỏi' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">{t('products.detail.faqs.hint')}</p>
                <FaqEditor
                  items={form.faqs}
                  onChange={(next) => updateField('faqs', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                  contentLang={contentLang}
                />
              </SectionCard>
            </>
          )}

          {activeTab === 'variants' && (
            <>
              {/* ── Card: Biến thể ── */}
              <SectionCard
                title={t('products.detail.variantSectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.variants.length} {t('products.detail.variantUnit', { defaultValue: 'biến thể' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <VariantsEditor
                  items={form.variants}
                  onChange={(next) => updateField('variants', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                  onOpenMatrixWizard={() => setShowMatrixWizard(true)}
                />
              </SectionCard>

              {/* ── Card: Sản phẩm liên quan ── */}
              <SectionCard
                title={t('products.detail.sectionRelated')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.relatedProductIds.length} {t('products.detail.relatedUnit', { defaultValue: 'sản phẩm' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">{t('products.detail.relatedHint')}</p>

                {form.relatedProductChips.length > 0 && (
                  <div className="chip-row mt-2">
                    {form.relatedProductChips.map((chip) => (
                      <span key={chip.id} className="chip">
                        {chip.imageUrl && (
                          <img src={chip.imageUrl} alt="" className="w-5 h-5 object-cover" />
                        )}
                        <strong>{chip.name}</strong>
                        {!isReadOnly && (
                          <span
                            className="x"
                            role="button"
                            tabIndex={0}
                            onClick={() => removeRelatedProduct(chip.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') removeRelatedProduct(chip.id) }}
                            aria-label={t('products.detail.relatedRemove', { name: chip.name })}
                          >×</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {!isReadOnly && (
                  <div className="relative mt-2">
                    <Input
                      value={relatedSearch}
                      onChange={(e) => setRelatedSearch(e.target.value)}
                      placeholder={t('products.detail.relatedSearch')}
                    />
                    {relatedSearchDebounced.length >= 1 && (
                      <div className="row-menu left-0 right-0 min-w-0 max-h-64 overflow-y-auto">
                        {isSearchingRelated ? (
                          <p className="text-sm text-muted-foreground px-2.5 py-2">
                            {t('products.detail.relatedSearching')}
                          </p>
                        ) : relatedSearchItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground px-2.5 py-2">
                            {t('products.detail.relatedEmpty')}
                          </p>
                        ) : (
                          relatedSearchItems.map((product) => {
                            const already = form.relatedProductIds.includes(product.id)
                            return (
                              <button
                                key={product.id}
                                type="button"
                                disabled={already}
                                onClick={() => addRelatedProduct(product)}
                                className={already ? 'opacity-50 cursor-not-allowed' : undefined}
                              >
                                {product.image?.url && (
                                  <img src={product.image.url} alt="" className="w-6 h-6 object-cover" />
                                )}
                                <span className="flex-1">{product.name}</span>
                                {already && (
                                  <span className="text-xs text-muted-foreground">{t('products.detail.relatedAdded')}</span>
                                )}
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </form>

        <StickyActionBar
          info={
            <span className="flex items-center gap-2 text-sm">
              <span className={cn('w-2 h-2 rounded-full', saveDotClass)} />
              <span className="font-medium">{saveLabel}</span>
            </span>
          }
        >
          <Button
            variant="outline"
            type="button"
            disabled={isReadOnly || !isDirty}
            onClick={() => handleSave('DRAFT')}
          >
            {t('products.detail.saveDraft')}
          </Button>

          <div className="flex">
            <Button
              type="button"
              disabled={isReadOnly || isSubmitting}
              className="rounded-r-none"
              onClick={() => handleSave(isPublished ? undefined : 'PUBLISHED')}
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
              {primaryLabel}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  disabled={isReadOnly || isSubmitting}
                  className="rounded-l-none border-l border-white/20 px-2"
                  aria-label={t('products.detail.moreSaveOptions', { defaultValue: 'Thêm tuỳ chọn lưu' })}
                >
                  <ChevronDown size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSave('DRAFT')}>
                  {t('products.detail.saveDraft')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSave('HIDDEN')}>
                  {t('products.detail.saveHidden')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </StickyActionBar>

        {/* Modals */}
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
      </Screen>
    </div>
  )
}
