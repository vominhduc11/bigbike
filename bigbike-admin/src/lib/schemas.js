import { z } from 'zod'
import { parseSpecStatsFromHtml } from './specStatsBlock'
import { parseTrustBadgesFromHtml } from './trustBadgesBlock'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const URL_REGEX = /^https?:\/\//
// Media URLs may be absolute (http(s)://) or relative paths served by the
// /media/* proxy (e.g. "/media/foo.jpg"). The MediaPickerModal returns the
// latter, so image/gallery/video fields must accept both forms.
const MEDIA_URL_REGEX = /^(?:https?:\/\/|\/)/
export const COLOR_ATTRIBUTE_KEYS = new Set(['color', 'colour', 'mau', 'mau sac', 'pa color', 'pa mau', 'pa mau sac'])

/**
 * Optional English URL slug (V213/V214/V215): empty is allowed (falls back to the
 * vi slug); when filled it must be valid kebab-case ≤ 100 chars. Errors target
 * `translations.en.slug` so the per-language slug field highlights correctly.
 */
function validateEnSlug(t, slug, ctx) {
  const s = String(slug || '').trim()
  if (!s) return
  if (!SLUG_REGEX.test(s)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('common.errEnSlugFormat', { defaultValue: 'Đường dẫn tiếng Anh chỉ gồm chữ thường, số và dấu gạch ngang.' }), path: ['translations', 'en', 'slug'] })
  } else if (s.length > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('common.errEnSlugTooLong', { defaultValue: 'Đường dẫn tiếng Anh tối đa 100 ký tự.' }), path: ['translations', 'en', 'slug'] })
  }
}

export function normalizeVariantToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0110/g, 'D')
    .replace(/\u0111/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function isColorAttributeName(name) {
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
      slug: isCreate ? slugField(t) : z.string().regex(SLUG_REGEX, t('products.detail.errSlugFormat')).optional().or(z.literal('')),
      name: isCreate ? z.string().min(1, t('products.detail.errNameRequired')) : z.string().optional(),
      categoryId: isCreate ? z.string().min(1, t('products.detail.errCategoryRequired')) : z.string().optional(),
      // Khai báo để superRefine "bắt buộc khi tạo mới" nhìn thấy (z.object strip key lạ).
      sku: z.string().optional(),
      brandId: z.string().optional(),
      gender: z.string().optional(),
      description: z.string().optional(),
      descriptionBlocks: z.array(z.any()).nullable().optional(),
      shortDescription: z.string().optional(),
      // "Dán mã HTML" cho khối Thông số kỹ thuật (V255) — vi; bản en ở translations.en.
      specificationsHtml: z.string().max(50000, 'Mã HTML thông số tối đa 50000 ký tự.').nullable().optional(),
      // "Dán mã HTML" cho khối Ô số liệu nổi bật (V256) — vi; bản en ở translations.en.
      specStatsHtml: z.string().max(50000, 'Mã HTML ô số liệu tối đa 50000 ký tự.').nullable().optional(),
      // "Dán mã HTML" cho khối Dải tin cậy (V257) — vi; bản en ở translations.en.
      trustBadgesHtml: z.string().max(50000, 'Mã HTML dải tin cậy tối đa 50000 ký tự.').nullable().optional(),
      retailPrice: z.string().optional(),
      compareAtPrice: z.string().optional(),
      salePrice: z.string().optional(),
      publishStatus: isCreate ? z.string().min(1, t('products.detail.errPublishRequired')) : z.string().optional(),
      imageUrl: z.string().optional(),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
      seoCanonicalUrl: z.string().optional(),
      seoOgImageUrl: z.string().optional(),
      seoOgImageAlt: z.string().optional(),
      gallery: z.array(z.object({
        url: z.string(),
        alt: z.string().optional(),
        caption: z.string().max(500, 'Chú thích ảnh tối đa 500 ký tự.').optional(),
      })).max(50, 'Thư viện ảnh tối đa 50 ảnh.').optional(),
      videos: z.array(z.object({
        url: z.string(),
        title: z.string(),
        type: z.enum(['youtube', 'tiktok', 'facebook', 'upload']).optional(),
      })).max(20, 'Danh sách video tối đa 20 video.').optional(),
      specifications: z.array(z.object({
        _key: z.string().optional(),
        name: z.string().max(255, 'Tên thông số tối đa 255 ký tự.'),
        value: z.string().max(2000, 'Giá trị thông số tối đa 2000 ký tự.'),
        groupName: z.string().max(100, 'Tên nhóm tối đa 100 ký tự.').optional(),
      })).max(100, 'Thông số kỹ thuật tối đa 100 mục.').optional(),
      // "Specs Dashboard" — ô số liệu nổi bật dưới khu vực mua hàng (V235); tối đa 4, song ngữ.
      specStats: z.array(z.object({
        _key: z.string().optional(),
        value: z.string().max(60, 'Số liệu tối đa 60 ký tự.'),
        label: z.string().max(80, 'Nhãn tối đa 80 ký tự.'),
        valueEn: z.string().max(60).optional(),
        labelEn: z.string().max(80).optional(),
      })).max(4, 'Tối đa 4 ô số liệu nổi bật.').optional(),
      faqs: z.array(z.object({
        _key: z.string().optional(),
        question: z.string().max(500, 'Câu hỏi tối đa 500 ký tự.'),
        answer: z.string().max(20000, 'Câu trả lời tối đa 20000 ký tự.'),
      })).max(50, 'FAQs tối đa 50 câu hỏi.').optional(),
      // Cam kết theo từng sản phẩm (V232) — tùy chọn; chỉ kiểm tra độ dài.
      commitments: z.array(z.object({
        _key: z.string().optional(),
        icon: z.string().max(40).optional(),
        title: z.string().max(200, 'Tiêu đề cam kết tối đa 200 ký tự.'),
        subtitle: z.string().max(300, 'Mô tả cam kết tối đa 300 ký tự.').optional(),
        titleEn: z.string().max(200).optional(),
        subtitleEn: z.string().max(300).optional(),
      })).max(12, 'Cam kết tối đa 12 mục.').optional(),
      // Dải tin cậy trên tên sản phẩm (V233) — badge {content}; bắt buộc ≥1 khi tạo mới (superRefine).
      trustBadges: z.array(z.object({
        _key: z.string().optional(),
        content: z.string().max(120, 'Nhãn tin cậy tối đa 120 ký tự.').optional(),
        contentEn: z.string().max(120).optional(),
      })).max(12, 'Nhãn tin cậy tối đa 12 nhãn.').optional(),
      variants: z.array(z.object({
        name: z.string(),
        // PRODUCT_RULE_SKU_001 — required per-row when the variant is real (has a
        // name); enforced in superRefine so blank scratch rows aren't flagged.
        sku: z.string().optional(),
        imageUrl: z.string().optional(),
        options: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
        gallery: z.array(z.object({
          url: z.string(),
          alt: z.string().optional(),
          caption: z.string().max(500, 'Chú thích ảnh tối đa 500 ký tự.').optional(),
        })).optional(),
      })).max(200, 'Biến thể tối đa 200 mục.').optional(),
      relatedProductIds: z.array(z.string()).max(24, 'Sản phẩm liên quan tối đa 24 mục.').optional(),
      accessoryProductIds: z.array(z.string()).max(24, 'Phụ kiện tối đa 24 mục.').optional(),
      // Template SEO fields (V175) — optional, length/integer checked in superRefine.
      positiveNotes: z.array(z.object({
        _key: z.string().optional(),
        content: z.string().max(2000, 'Ưu điểm tối đa 2000 ký tự.'),
        contentEn: z.string().max(2000).optional(),
      })).max(20, 'Ưu điểm tối đa 20 mục.').optional(),
      negativeNotes: z.array(z.object({
        _key: z.string().optional(),
        content: z.string().max(2000, 'Nhược điểm tối đa 2000 ký tự.'),
        contentEn: z.string().max(2000).optional(),
      })).max(20, 'Nhược điểm tối đa 20 mục.').optional(),
      originBrandCountry: z.string().max(120).optional(),
      sizeGuide: z.string().max(20000, 'Bảng size tối đa 20000 ký tự.').optional(),
      // PDP layout field (V237) — "Phù hợp với ai".
      suitabilityAdvisory: z.string().max(20000, 'Phù hợp với ai tối đa 20000 ký tự.').optional(),
      // Optional English content (V136) — never required, length-checked only.
      translations: z.object({
        en: z.object({
          slug: z.string().optional(),
          name: z.string().optional(),
          shortDescription: z.string().optional(),
          description: z.string().optional(),
          suitabilityAdvisory: z.string().max(20000, 'Phù hợp với ai tối đa 20000 ký tự.').optional(),
          specificationsHtml: z.string().max(50000, 'Mã HTML thông số tối đa 50000 ký tự.').optional(),
          specStatsHtml: z.string().max(50000, 'Mã HTML ô số liệu nổi bật tối đa 50000 ký tự.').optional(),
          trustBadgesHtml: z.string().max(50000, 'Mã HTML dải tin cậy tối đa 50000 ký tự.').optional(),
          seoTitle: z.string().optional(),
          seoDescription: z.string().optional(),
        }).optional(),
      }).optional(),
    })
    .superRefine((data, ctx) => {
      // Bắt buộc CHỈ KHI TẠO MỚI ở trạng thái PUBLISHED (không áp dụng khi sửa sản phẩm cũ hoặc lưu nháp).
      // slug/name/categoryId đã bắt buộc ở khai báo field phía trên; ở đây thêm các trường còn lại.
      if (isCreate && data.publishStatus === 'PUBLISHED') {
        const req = (val, message, path) => {
          if (!String(val ?? '').trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message, path })
          }
        }
        req(data.sku, t('products.detail.errSkuRequired', { defaultValue: 'Vui lòng nhập mã SKU sản phẩm.' }), ['sku'])
        req(data.brandId, t('products.detail.errBrandRequired', { defaultValue: 'Vui lòng chọn thương hiệu.' }), ['brandId'])
        req(data.gender, t('products.detail.errGenderRequired', { defaultValue: 'Vui lòng chọn đối tượng (giới tính).' }), ['gender'])
        req(data.imageUrl, t('products.detail.errImageRequired', { defaultValue: 'Vui lòng chọn ảnh đại diện.' }), ['imageUrl'])
      }

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
      // PRODUCT_RULE_SKU_001 — every real variant (one with a name; blank rows are
      // dropped at payload time) must carry a SKU, and SKUs must be unique within the
      // product (case-insensitive). Mirrors @NotBlank + uniqueness on the backend.
      const seenSku = new Map()
      ;(data.variants ?? []).forEach((v, i) => {
        const name = (v?.name ?? '').trim()
        const sku = (v?.sku ?? '').trim()
        if (name && !sku) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errVariantSkuRequired'), path: ['variants', i, 'sku'] })
          return
        }
        if (!sku) return
        const key = sku.toLowerCase()
        if (seenSku.has(key)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('products.detail.errVariantSkuDuplicate'), path: ['variants', i, 'sku'] })
        } else {
          seenSku.set(key, i)
        }
      })
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
      if (String(data.contentBottom ?? '').length > 50000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('products.detail.errContentBottomTooLong'),
          path: ['contentBottom'],
        })
      }
      if ((data.seoTitle ?? '').trim().length > 255) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('products.detail.errSeoTitleTooLong'),
          path: ['seoTitle'],
        })
      }
      if ((data.seoDescription ?? '').trim().length > 5000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('products.detail.errSeoDescriptionTooLong'),
          path: ['seoDescription'],
        })
      }
      if ((data.seoCanonicalUrl ?? '').trim() && !URL_REGEX.test(data.seoCanonicalUrl.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('products.detail.errSeoCanonicalUrl'),
          path: ['seoCanonicalUrl'],
        })
      }
      if ((data.seoOgImageUrl ?? '').trim() && !MEDIA_URL_REGEX.test(data.seoOgImageUrl.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('products.detail.errSeoOgImageUrl'),
          path: ['seoOgImageUrl'],
        })
      }
      if ((data.seoOgImageAlt ?? '').trim().length > 255) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('products.detail.errSeoOgImageAltTooLong'),
          path: ['seoOgImageAlt'],
        })
      }

      // English content (V136): optional, length-checked only. Plain inputs are
      // already capped by maxLength; this guards the rich-text fields.
      const en = data.translations?.en ?? {}
      const enLimits = [
        ['name', 255], ['shortDescription', 2000], ['description', 20000],
        ['contentBottom', 50000], ['specificationsHtml', 50000], ['specStatsHtml', 50000], ['trustBadgesHtml', 50000],
        ['seoTitle', 255], ['seoDescription', 5000],
      ]
      for (const [field, max] of enLimits) {
        if (String(en[field] ?? '').length > max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('products.detail.errEnglishTooLong', { defaultValue: 'Nội dung tiếng Anh quá dài.' }),
            path: ['translations', 'en', field],
          })
        }
      }
      // English URL slug (V214): optional; when filled must be valid kebab-case ≤ 100.
      validateEnSlug(t, en.slug, ctx)

      // Specifications: rows that have any content must have both name and value.
      data.specifications?.forEach((s, i) => {
        const name = (s.name || '').trim()
        const value = (s.value || '').trim()
        const group = (s.groupName || '').trim()
        if (!name && !value && !group) return
        if (!name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập tên thông số.', path: ['specifications', i, 'name'] })
        if (!value) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập giá trị thông số.', path: ['specifications', i, 'value'] })
      })

      // FAQs: rows that have any content must have both question and answer.
      data.faqs?.forEach((f, i) => {
        const question = (f.question || '').trim()
        const answer = (f.answer || '').trim()
        if (!question && !answer) return
        if (!question) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập câu hỏi.', path: ['faqs', i, 'question'] })
        if (!answer) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Vui lòng nhập câu trả lời.', path: ['faqs', i, 'answer'] })
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
        if (v.type === 'tiktok') {
          // Link đầy đủ TikTok (vt./vm. short link không có id số → reject).
          if (!/(?:www\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/|video\/|v\/|embed\/v2\/|embed\/)\d{6,30}/.test(url)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'URL TikTok không hợp lệ. Dán link đầy đủ dạng tiktok.com/@tên/video/… (không dùng link rút gọn vt.tiktok.com).', path: ['videos', i, 'url'] })
          }
          return
        }
        if (v.type === 'facebook') {
          // Link video Facebook đầy đủ (fb.watch rút gọn → reject).
          if (!/^https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?:[^?#]*\/videos\/|reel\/|watch\/?(?:\?|$)|[^?#]*video\.php)/i.test(url)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'URL Facebook không hợp lệ. Dán link video Facebook đầy đủ (không dùng link rút gọn fb.watch); video phải công khai.', path: ['videos', i, 'url'] })
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
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Biến thể cần ít nhất một thuộc tính (Màu sắc, Kích cỡ...) để tự tạo tên.', path: ['variants', i, 'options'] })
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
        const hasVariantGallery = v.gallery?.some((img) => img.url.trim() || (img.videoUrl || '').trim()) ?? false
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
      description: z.string().optional(),
      introContent: z.string().optional(),
      imageUrl: z.string().optional(),
      bannerImageUrl: z.string().optional(),
      heroImageUrl: z.string().optional(),
      menuIconUrl: z.string().optional(),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
      seoCanonicalUrl: z.string().optional(),
      seoOgImageUrl: z.string().optional(),
      seoOgImageAlt: z.string().optional(),
      // Optional English content (V137 + V213 slug) — never required, validated for format/length only.
      translations: z.object({
        en: z.object({
          slug: z.string().optional(),
          name: z.string().optional(),
          description: z.string().optional(),
          introContent: z.string().optional(),
          seoTitle: z.string().optional(),
          seoDescription: z.string().optional(),
        }).optional(),
      }).optional(),
    })
    .superRefine((data, ctx) => {
      validateEnSlug(t, data.translations?.en?.slug, ctx)
      const s = String(data.slug || '').trim()
      if (!s) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errSlugRequired'), path: ['slug'] })
      } else if (!SLUG_REGEX.test(s)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errSlugFormat'), path: ['slug'] })
      } else if (s.length > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errSlugTooLong'), path: ['slug'] })
      }
      if ((data.name ?? '').trim().length > 255) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errNameTooLong'), path: ['name'] })
      }
      if ((data.introContent ?? '').trim().length > 50000) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errIntroContentTooLong'), path: ['introContent'] })
      }
      if (data.imageUrl?.trim() && !MEDIA_URL_REGEX.test(data.imageUrl.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errImageUrl'), path: ['imageUrl'] })
      }
      if (data.bannerImageUrl?.trim() && !MEDIA_URL_REGEX.test(data.bannerImageUrl.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errBannerImageUrl'), path: ['bannerImageUrl'] })
      }
      if (data.heroImageUrl?.trim() && !MEDIA_URL_REGEX.test(data.heroImageUrl.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errHeroImageUrl'), path: ['heroImageUrl'] })
      }
      if (data.menuIconUrl?.trim() && !MEDIA_URL_REGEX.test(data.menuIconUrl.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errMenuIconUrl'), path: ['menuIconUrl'] })
      }
      if ((data.seoTitle ?? '').trim().length > 255) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errSeoTitleTooLong'), path: ['seoTitle'] })
      }
      if ((data.seoDescription ?? '').trim().length > 5000) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errSeoDescriptionTooLong'), path: ['seoDescription'] })
      }
      if ((data.seoCanonicalUrl ?? '').trim() && !URL_REGEX.test(data.seoCanonicalUrl.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errSeoCanonicalUrl'), path: ['seoCanonicalUrl'] })
      }
      if ((data.seoOgImageUrl ?? '').trim() && !MEDIA_URL_REGEX.test(data.seoOgImageUrl.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errSeoOgImageUrl'), path: ['seoOgImageUrl'] })
      }
      if ((data.seoOgImageAlt ?? '').trim().length > 255) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('categories.detail.errSeoOgImageAltTooLong'), path: ['seoOgImageAlt'] })
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
    // Optional English content (V137 + V215 slug) — validated for format/length only.
    translations: z.object({
      en: z.object({
        slug: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        seoTitle: z.string().optional(),
        seoDescription: z.string().optional(),
      }).optional(),
    }).optional(),
  }).superRefine((data, ctx) => {
    validateEnSlug(t, data.translations?.en?.slug, ctx)
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
    // Công tắc bài viết — boolean optional, không có validation đặc biệt.
    featured: z.boolean().optional(),
    seoNoIndex: z.boolean().optional(),
    pageType: z.string().optional(),
    coverImageUrl: z.string().optional(),
    productImageUrl: z.string().optional(),
    relatedProductIds: z.array(z.string()).optional(),
    accessoryProductIds: z.array(z.string()).optional(),
    seoCanonicalUrl: z.string().optional(),
    seoOgImageUrl: z.string().optional(),
    // Optional English content (V138 + V216 slug) — never required; slug chỉ áp dụng cho BÀI VIẾT.
    translations: z.object({
      en: z.object({
        slug: z.string().optional(),
        title: z.string().optional(),
        excerpt: z.string().optional(),
        body: z.string().optional(),
        seoTitle: z.string().optional(),
        seoDescription: z.string().optional(),
      }).optional(),
    }).optional(),
  }).superRefine((data, ctx) => {
    // English URL slug chỉ có ở bài viết (ARTICLE_RULE_003); trang tĩnh giữ PAGE_RULE_003.
    if (normalizedType === 'ARTICLE') {
      validateEnSlug(t, data.translations?.en?.slug, ctx)
    }
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
