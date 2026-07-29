import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { ImageUrlInput } from './ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Thẻ SEO dùng chung (Danh mục, Thương hiệu, …). Gộp bản trùng ~95 dòng trước đây ở
// BrandDetailScreen với category-detail/SeoCard (audit P1-13). Tham số hoá theo:
//   i18nPrefix     — tiền tố khoá dịch, vd 'categories.detail' | 'brands.detail'
//   descKey        — khoá dịch cho dòng mô tả nhỏ dưới tiêu đề
//   previewBase    — gốc URL để dựng preview Google (vd '.../danh-muc')
//   previewSlugDefault — slug mẫu khi chưa nhập
// `collapsible`/`open`/`onToggle`: gập thẻ để chống ngợp form (audit P0-2). Khi gập,
// chỉ hiện tiêu đề + chevron, ẩn body.
export function SeoCard({
  form, isEnLang, isReadOnly, validationErrors,
  updateField, updateTranslation, onFieldBlur,
  i18nPrefix, descKey, previewBase, previewSlugDefault,
  collapsible = false, open = true, onToggle,
}) {
  const { t } = useTranslation()
  const p = (key, defaultValue) => t(`${i18nPrefix}.${key}`, { defaultValue })
  const uid = useId()
  const errId = (name) => `${uid}-${name}`

  // Guard undefined: partial/nháp form có thể chưa có các field này → tránh crash khi
  // gọi .trim()/.length và tránh cảnh báo controlled input.
  const seoTitleVal = (isEnLang ? form.translations?.en?.seoTitle : form.seoTitle) ?? ''
  const seoDescVal = (isEnLang ? form.translations?.en?.seoDescription : form.seoDescription) ?? ''
  const nameVal = (isEnLang ? form.translations?.en?.name : form.name) ?? ''
  const previewSlug = (isEnLang ? (form.translations?.en?.slug || form.slug) : form.slug) || previewSlugDefault
  const canonicalUrlVal = form.seoCanonicalUrl ?? ''
  const previewUrl = canonicalUrlVal.trim() || `${previewBase}/${previewSlug}`

  const enHint = isEnLang && (
    <span className="hint" style={{ display: 'inline', marginLeft: 8 }}>
      {p('enFieldHint', '(tiếng Anh — tùy chọn)')}
    </span>
  )

  const title = p('sectionSeo', 'Hiển thị trên Google & mạng xã hội')
  const desc = t(descKey, { defaultValue: 'Tinh chỉnh tiêu đề, mô tả và ảnh khi được tìm kiếm hoặc chia sẻ.' })
  const bodyVisible = !collapsible || open

  return (
    <div className="bb-card mb-4">
      {collapsible ? (
        <Button
          variant="unstyled"
          className="bb-card-header w-full text-left cursor-pointer"
          onClick={onToggle}
          aria-expanded={open}
        >
          <div className="flex items-start gap-2">
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={cn('mt-0.5 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
            />
            <div>
              <h2>{title}</h2>
              <p className="sub">{desc}</p>
            </div>
          </div>
        </Button>
      ) : (
        <div className="bb-card-header">
          <div>
            <h2>{title}</h2>
            <p className="sub">{desc}</p>
          </div>
        </div>
      )}
      {bodyVisible && (
      <div className="bb-card-body">
        <div className="mb-4 rte-canvas-frame">
          {/* Nền trắng cố ý: đây là bản mô phỏng thẻ kết quả Google (luôn nền trắng),
              các màu chữ google-* chỉ hợp trên nền sáng — không đổi theo theme admin. */}
          <div className="p-3 border border-border bg-white">
            <div className="text-xs text-google-url mb-1">{p('seoPreviewLabel', 'Xem thử trên Google')}</div>
            <div className="text-xs text-google-url break-all mb-1">{previewUrl}</div>
            <div className="text-lg leading-snug text-google-title break-words mb-1">
              {(seoTitleVal || nameVal || p('seoPreviewFallbackTitle', 'Tiêu đề')).slice(0, 60)}
            </div>
            <div className="text-sm leading-relaxed text-google-description break-words">
              {seoDescVal || p('seoPreviewFallbackDesc', 'Mô tả ngắn sẽ hiển thị ở đây.')}
            </div>
          </div>
        </div>

        <label className="form-field">
          <span className="flex items-center justify-between">
            <span>{p('seoTitle', 'Tiêu đề khi xuất hiện trên Google')}{enHint}</span>
            <span className={`hint ${seoTitleVal.length > 60 ? 'text-danger' : ''}`}>{seoTitleVal.length} / 60</span>
          </span>
          <Input
            value={seoTitleVal}
            onChange={(e) => isEnLang ? updateTranslation('seoTitle', e.target.value) : updateField('seoTitle', e.target.value)}
            onBlur={!isEnLang ? () => onFieldBlur?.('seoTitle') : undefined}
            disabled={isReadOnly}
            maxLength={255}
            placeholder={p('seoTitlePlaceholder', 'Để trống sẽ tự dùng tên')}
            aria-invalid={validationErrors.seoTitle ? true : undefined}
            aria-describedby={validationErrors.seoTitle ? errId('seoTitle') : undefined}
          />
          {validationErrors.seoTitle && (
            <span id={errId('seoTitle')} role="alert" className="hint text-danger flex items-center gap-1">
              <AlertCircle size={13} aria-hidden="true" />{validationErrors.seoTitle}
            </span>
          )}
        </label>
        <label className="form-field">
          <span className="flex items-center justify-between">
            <span>{p('seoDescription', 'Mô tả khi xuất hiện trên Google')}{enHint}</span>
            <span className={`hint ${seoDescVal.length > 160 ? 'text-danger' : ''}`}>{seoDescVal.length} / 160</span>
          </span>
          <Textarea
            rows={3}
            value={seoDescVal}
            onChange={(e) => isEnLang ? updateTranslation('seoDescription', e.target.value) : updateField('seoDescription', e.target.value)}
            onBlur={!isEnLang ? () => onFieldBlur?.('seoDescription') : undefined}
            disabled={isReadOnly}
            placeholder={p('seoDescriptionPlaceholder', 'Mô tả ngắn hiển thị dưới tiêu đề trên Google')}
            aria-invalid={validationErrors.seoDescription ? true : undefined}
            aria-describedby={validationErrors.seoDescription ? errId('seoDescription') : undefined}
          />
          {validationErrors.seoDescription && (
            <span id={errId('seoDescription')} role="alert" className="hint text-danger flex items-center gap-1">
              <AlertCircle size={13} aria-hidden="true" />{validationErrors.seoDescription}
            </span>
          )}
        </label>
        <label className="form-field">
          <span>{p('seoCanonicalUrl', 'Địa chỉ chuẩn (canonical URL)')}</span>
          <Input
            value={canonicalUrlVal}
            onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
            onBlur={() => onFieldBlur?.('seoCanonicalUrl')}
            disabled={isReadOnly}
            placeholder={p('seoCanonicalUrlPlaceholder', 'https://bigbike.vn/...')}
            aria-invalid={validationErrors.seoCanonicalUrl ? true : undefined}
            aria-describedby={validationErrors.seoCanonicalUrl ? errId('seoCanonicalUrl') : undefined}
          />
          {validationErrors.seoCanonicalUrl && (
            <span id={errId('seoCanonicalUrl')} role="alert" className="hint text-danger flex items-center gap-1">
              <AlertCircle size={13} aria-hidden="true" />{validationErrors.seoCanonicalUrl}
            </span>
          )}
        </label>
        {/* Ảnh chia sẻ mạng xã hội (OG image) — dùng chung cho cả hai ngôn ngữ */}
        <div className="form-field" data-field="seoOgImageUrl">
          <span>{p('seoOgImageUrl', 'Ảnh hiển thị khi chia sẻ trên mạng xã hội')}</span>
          <ImageUrlInput
            value={form.seoOgImageUrl}
            onChange={(url) => updateField('seoOgImageUrl', url)}
            alt={form.seoOgImageAlt}
            onAltChange={(v) => updateField('seoOgImageAlt', v)}
            disabled={isReadOnly}
            error={validationErrors.seoOgImageUrl}
            recommend={IMAGE_RECO.cover}
          />
          <span className="hint">{p('seoOgImageUrlHint', 'Ảnh chia sẻ lên Facebook/Zalo, kích thước 1200×630px.')}</span>
        </div>
      </div>
      )}
    </div>
  )
}
