import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageIcon, X } from 'lucide-react'
import { MediaPickerModal } from './MediaPickerModal'
import { MediaRequirementHint } from './MediaRequirementHint'
import { Button } from '@/components/ui/button'
import { resolveDisplayUrl } from '@/lib/contracts'
import { useMediaAltSync } from '@/lib/useMediaAltSync'
import { useHasPermission } from '@/lib/auth'

function ImagePreview({ url, alt }) {
  const { t } = useTranslation()
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  // Guard undefined: caller có thể truyền value undefined (form nháp/partial).
  const trimmed = resolveDisplayUrl((url ?? '').trim())

  useEffect(() => {
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOk(false)
      return
    }
    setLoading(true)
    const img = new Image()
    img.loading = 'eager'
    img.onload = () => {
      setOk(true)
      setLoading(false)
    }
    img.onerror = () => {
      setOk(false)
      setLoading(false)
    }
    img.src = trimmed
  }, [trimmed])

  if (!trimmed) return null
  if (loading)
    return <div className="img-preview img-preview-loading">{t('imageInput.previewLoading')}</div>
  if (!ok)
    return <div className="img-preview img-preview-error">{t('imageInput.previewError')}</div>
  return (
    <img
      src={trimmed}
      alt={alt || t('imageInput.previewAlt')}
      className="img-preview"
      loading="eager"
    />
  )
}

export function ImageUrlInput({
  value,
  onChange,
  alt,
  onAltChange,
  previewAlt,
  disabled,
  error,
  recommend,
}) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const hasPermission = useHasPermission()
  const canReadMedia = hasPermission('media.read')
  const hasImage = Boolean(value?.trim())
  const { pickAlt } = useMediaAltSync()
  const errorId = useId()

  return (
    <div className="image-url-input">
      <div className="image-url-input-row">
        <Button
          variant="secondary"
          size="sm"
          className="image-url-pick-btn"
          type="button"
          onClick={() => {
            if (canReadMedia) setPickerOpen(true)
          }}
          disabled={disabled || !canReadMedia}
          title={!canReadMedia ? t('media.permissionDeniedDesc') : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        >
          <ImageIcon size={14} aria-hidden="true" />
          {hasImage ? t('imageInput.changeImage') : t('imageInput.pickFromLibrary')}
        </Button>
        {hasImage && (
          <Button
            variant="ghost"
            size="icon"
            className="text-danger hover:bg-danger-bg"
            type="button"
            onClick={() => {
              onChange('')
              onAltChange?.('')
            }}
            disabled={disabled}
            aria-label={t('imageInput.removeImage')}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
      {!canReadMedia ? (
        <small className="text-xs text-muted-foreground">{t('media.permissionDeniedDesc')}</small>
      ) : null}
      {error && (
        <small id={errorId} role="alert" className="field-error">
          {error}
        </small>
      )}
      <MediaRequirementHint recommend={recommend} className="mt-1 text-xs text-muted-foreground" />
      <ImagePreview url={value} alt={previewAlt || alt} />

      {pickerOpen && canReadMedia && (
        <MediaPickerModal
          recommend={recommend}
          kind="image"
          onSelect={(url, media) => {
            // 2nd arg forwarded so callers with their own decoupled alt field
            // (no onAltChange/no built-in alt UI here) can still prefill/sync it.
            onChange(url, media)
            if (typeof onAltChange === 'function') onAltChange(pickAlt(alt, media))
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
