import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MediaPickerModal } from './MediaPickerModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function IconLibrary() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function ImagePreview({ url }) {
  const { t } = useTranslation()
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const trimmed = url.trim()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!trimmed) { setOk(false); return }
    setLoading(true)
    const img = new Image()
    img.loading = 'eager'
    img.onload = () => { setOk(true); setLoading(false) }
    img.onerror = () => { setOk(false); setLoading(false) }
    img.src = trimmed
  }, [trimmed])

  if (!trimmed) return null
  if (loading) return <div className="img-preview img-preview-loading">{t('imageInput.previewLoading')}</div>
  if (!ok) return <div className="img-preview img-preview-error">{t('imageInput.previewError')}</div>
  return <img src={trimmed} alt={t('imageInput.previewAlt')} className="img-preview" loading="eager" />
}

export function ImageUrlInput({ value, onChange, alt, onAltChange, disabled, error }) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const hasImage = Boolean(value?.trim())

  return (
    <div className="image-url-input">
      <div className="image-url-input-row">
        <Button variant="secondary" size="sm" className="image-url-pick-btn"
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
        >
          <IconLibrary />
          {hasImage ? t('imageInput.changeImage') : t('imageInput.pickFromLibrary')}
        </Button>
        {hasImage && (
          <Button variant="ghost" size="icon" className="text-danger hover:bg-danger-bg"
            type="button"
            onClick={() => { onChange(''); onAltChange?.('') }}
            disabled={disabled}
            aria-label={t('imageInput.removeImage')}
          >
            ✕
          </Button>
        )}
      </div>
      {error && <small className="field-error">{error}</small>}
      <ImagePreview url={value} />
      {hasImage && onAltChange !== undefined && (
        <Input
          type="text"
          placeholder={t('imageInput.altPlaceholder')}
          value={alt ?? ''}
          onChange={(e) => onAltChange(e.target.value)}
          disabled={disabled}
          maxLength={255}
          className="mt-2"
         />
      )}
      {pickerOpen && (
        <MediaPickerModal
          onSelect={(url) => { onChange(url); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
