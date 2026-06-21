import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { ImageUrlInput } from '../../components/ImageUrlInput'
import { IMAGE_RECO } from '../../lib/imageRecommendations'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { STOREFRONT_BASE } from './constants'

export function SeoCard({ form, isEnLang, isReadOnly, validationErrors, updateField, updateTranslation }) {
  const { t } = useTranslation()
  const seoTitleVal = isEnLang ? (form.translations?.en?.seoTitle ?? '') : form.seoTitle
  const seoDescVal = isEnLang ? (form.translations?.en?.seoDescription ?? '') : form.seoDescription
  const nameVal = isEnLang ? (form.translations?.en?.name ?? '') : form.name
  const previewSlug = (isEnLang ? (form.translations?.en?.slug || form.slug) : form.slug) || 'duong-dan-danh-muc'
  const previewUrl = form.seoCanonicalUrl.trim() || `${STOREFRONT_BASE}/${previewSlug}`
  return (
    <div className="bb-card mb-4">
      <div className="bb-card-header">
        <div>
          <h2>{t('categories.detail.sectionSeo', { defaultValue: 'Hiển thị trên Google & mạng xã hội' })}</h2>
          <p className="sub">{t('categories.sectionSeoDesc', { defaultValue: 'Tinh chỉnh tiêu đề, mô tả và ảnh khi danh mục được tìm kiếm hoặc chia sẻ.' })}</p>
        </div>
      </div>
      <div className="bb-card-body">
        {/* Xem trước trên Google */}
        <div className="mb-4 p-3 border border-border bg-white">
          <div className="text-xs text-muted-foreground mb-1">{t('categories.detail.seoPreviewLabel', { defaultValue: 'Xem thử trên Google' })}</div>
          <div className="text-xs text-[#5f6368] break-all mb-1">{previewUrl}</div>
          <div className="text-lg leading-snug text-[#1a0dab] break-words mb-1">
            {(seoTitleVal || nameVal || t('categories.detail.seoPreviewFallbackTitle', { defaultValue: 'Tiêu đề danh mục' })).slice(0, 60)}
          </div>
          <div className="text-sm leading-relaxed text-[#4d5156] break-words">
            {seoDescVal || t('categories.detail.seoPreviewFallbackDesc', { defaultValue: 'Mô tả ngắn về danh mục sẽ hiển thị ở đây.' })}
          </div>
        </div>

        <label className="form-field">
          <span className="flex items-center justify-between">
            <span>
              {t('categories.detail.seoTitle', { defaultValue: 'Tiêu đề khi xuất hiện trên Google' })}
              {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 6 }}>{t('categories.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
            </span>
            <span className={`hint ${seoTitleVal.length > 60 ? 'text-danger' : ''}`}>{seoTitleVal.length} / 60</span>
          </span>
          <Input
            value={seoTitleVal}
            onChange={(e) => isEnLang ? updateTranslation('seoTitle', e.target.value) : updateField('seoTitle', e.target.value)}
            disabled={isReadOnly}
            maxLength={255}
            placeholder={t('categories.detail.seoTitlePlaceholder', { defaultValue: 'Để trống sẽ tự dùng tên danh mục' })}
          />
          {validationErrors.seoTitle && (
            <span className="hint text-danger flex items-center gap-1">
              <AlertCircle size={13} aria-hidden="true" />{validationErrors.seoTitle}
            </span>
          )}
        </label>
        <label className="form-field">
          <span className="flex items-center justify-between">
            <span>
              {t('categories.detail.seoDescription', { defaultValue: 'Mô tả khi xuất hiện trên Google' })}
              {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 6 }}>{t('categories.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
            </span>
            <span className={`hint ${seoDescVal.length > 160 ? 'text-danger' : ''}`}>{seoDescVal.length} / 160</span>
          </span>
          <Textarea
            rows={3}
            value={seoDescVal}
            onChange={(e) => isEnLang ? updateTranslation('seoDescription', e.target.value) : updateField('seoDescription', e.target.value)}
            disabled={isReadOnly}
            placeholder={t('categories.detail.seoDescriptionPlaceholder', { defaultValue: 'Mô tả ngắn hiển thị dưới tiêu đề trên Google' })}
          />
          {validationErrors.seoDescription && (
            <span className="hint text-danger flex items-center gap-1">
              <AlertCircle size={13} aria-hidden="true" />{validationErrors.seoDescription}
            </span>
          )}
        </label>
        <label className="form-field">
          <span>{t('categories.detail.seoCanonicalUrl', { defaultValue: 'Địa chỉ chuẩn (canonical URL)' })}</span>
          <Input
            value={form.seoCanonicalUrl}
            onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
            disabled={isReadOnly}
            placeholder="https://bigbike.vn/..."
          />
          {validationErrors.seoCanonicalUrl && (
            <span className="hint text-danger flex items-center gap-1">
              <AlertCircle size={13} aria-hidden="true" />{validationErrors.seoCanonicalUrl}
            </span>
          )}
        </label>
        {/* Ảnh chia sẻ mạng xã hội (OG image) — dùng chung cho cả hai ngôn ngữ */}
        <div className="form-field" data-field="seoOgImageUrl">
          <span>{t('categories.detail.seoOgImageUrl', { defaultValue: 'Ảnh hiển thị khi chia sẻ trên mạng xã hội' })}</span>
          <ImageUrlInput
            value={form.seoOgImageUrl}
            onChange={(url) => updateField('seoOgImageUrl', url)}
            alt={form.seoOgImageAlt}
            onAltChange={(v) => updateField('seoOgImageAlt', v)}
            disabled={isReadOnly}
            error={validationErrors.seoOgImageUrl}
            recommend={IMAGE_RECO.cover}
          />
          <span className="hint">{t('categories.detail.seoOgImageUrlHint', { defaultValue: 'Ảnh chia sẻ lên Facebook/Zalo, kích thước 1200×630px.' })}</span>
        </div>
      </div>
    </div>
  )
}
