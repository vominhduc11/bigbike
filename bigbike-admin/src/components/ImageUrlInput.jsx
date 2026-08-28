import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { MediaPickerModal } from './MediaPickerModal'
import { MediaRequirementHint } from './MediaRequirementHint'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resolveDisplayUrl } from '@/lib/contracts'
import { useMediaAltSync } from '@/lib/useMediaAltSync'
import { useHasPermission } from '@/lib/auth'
import { fetchMediaBlob, importBrandLogoUrl, uploadMedia } from '@/lib/adminApi'
import { BrandLogoCropDialog } from './BrandLogoCropDialog'
import {
  brandLogoIssueTranslationKey,
  brandLogoCheckerboardStyle,
  getBrandLogoSourceDecision,
  isBrandLogoBlockingIssue,
  inspectBrandLogoFile,
} from '@/lib/brandLogoPolicy'

function IconLibrary() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function ImagePreview({ url, alt, checkerboard = false }) {
  const { t } = useTranslation()
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  // Guard undefined: caller có thể truyền value undefined (form nháp/partial).
  const trimmed = resolveDisplayUrl((url ?? '').trim())

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
  return (
    <img
      src={trimmed}
      alt={alt || t('imageInput.previewAlt')}
      className="img-preview"
      loading="eager"
      style={checkerboard ? brandLogoCheckerboardStyle() : undefined}
    />
  )
}

export function ImageUrlInput({ value, onChange, alt, onAltChange, previewAlt, disabled, error, recommend }) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [externalUrl, setExternalUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importWarning, setImportWarning] = useState('')
  const [cropSource, setCropSource] = useState(null)
  const hasPermission = useHasPermission()
  const canReadMedia = hasPermission('media.read')
  const canWriteMedia = hasPermission('media.write')
  const isBrandLogo = Boolean(recommend?.brandLogo)
  const hasImage = Boolean(value?.trim())
  const { pickAlt } = useMediaAltSync()
  const errorId = useId()

  function issueMessage(issue, details) {
    return t(brandLogoIssueTranslationKey(issue), {
      w: details?.width,
      h: details?.height,
      defaultValue: issue,
    })
  }

  function failureMessage(failure, fallback) {
    const detailMessage = failure?.details?.find((detail) => detail?.message)?.message
    if (detailMessage) return detailMessage
    if (failure?.message === 'BRAND_LOGO_MEDIA_UNAVAILABLE') {
      return issueMessage('MEDIA_UNAVAILABLE')
    }
    return failure?.message || fallback
  }

  function brandLogoQualityFromDetails(details, issues) {
    return {
      status: 'VALID',
      issues,
      width: details?.width ?? null,
      height: details?.height ?? null,
      fileSize: details?.fileSize ?? null,
      mimeType: details?.mimeType ?? null,
      transparent: details?.transparent ?? null,
      ratio: details?.width && details?.height ? details.width / details.height : null,
    }
  }

  function revokeCropSource() {
    if (cropSource?.url?.startsWith('blob:')) URL.revokeObjectURL(cropSource.url)
    setCropSource(null)
  }

  async function acceptImportedMedia(media) {
    const { blob, filename } = await fetchMediaBlob(media.id, media.filename || 'brand-logo.png')
    const file = new File([blob], filename || 'brand-logo.png', { type: media.mimeType || blob.type || '' })
    const details = await inspectBrandLogoFile(file)
    const decision = getBrandLogoSourceDecision(details)
    const blockingIssues = decision.issues.filter(isBrandLogoBlockingIssue)
    if (blockingIssues.length) {
      setImportError(blockingIssues.map((issue) => issueMessage(issue, details)).join(' '))
      return
    }
    const warningIssues = decision.issues.filter((issue) => !isBrandLogoBlockingIssue(issue))
    setImportWarning(warningIssues.map((issue) => issueMessage(issue, details)).join(' '))
    if (decision.needsCrop) {
      setCropSource({
        url: URL.createObjectURL(file),
        filename: file.name,
        sourceMimeType: details.mimeType,
        sourceTransparent: details.transparent,
      })
      return
    }
    onChange(media.publicUrl, {
      ...media,
      width: media.width ?? details.width,
      height: media.height ?? details.height,
      fileSize: media.fileSize ?? details.fileSize,
      mimeType: details.mimeType,
      logoQuality: brandLogoQualityFromDetails(details, warningIssues),
    })
    setExternalUrl('')
  }

  async function handleExternalImport() {
    if (!isBrandLogo || !canWriteMedia || importing) return
    const url = externalUrl.trim()
    if (!url) return
    setImporting(true)
    setImportError('')
    setImportWarning('')
    try {
      const result = await importBrandLogoUrl({ url, altText: alt?.trim() || null })
      if (!result?.item?.id || !result.item.publicUrl) throw new Error('BRAND_LOGO_MEDIA_UNAVAILABLE')
      await acceptImportedMedia(result.item)
    } catch (importFailure) {
      setImportError(failureMessage(importFailure, t('brands.logo.errors.importFailed')))
    } finally {
      setImporting(false)
    }
  }

  async function handleCropComplete(file) {
    if (!cropSource) return
    revokeCropSource()
    setImporting(true)
    setImportError('')
    try {
      const details = await inspectBrandLogoFile(file)
      const decision = getBrandLogoSourceDecision(details)
      const blockingIssues = decision.issues.filter(isBrandLogoBlockingIssue)
      if (blockingIssues.length) {
        setImportError(blockingIssues.map((issue) => issueMessage(issue, details)).join(' '))
        return
      }
      const warningIssues = decision.issues.filter((issue) => !isBrandLogoBlockingIssue(issue))
      setImportWarning(warningIssues.map((issue) => issueMessage(issue, details)).join(' '))
      const result = await uploadMedia(file, alt?.trim() || '')
      const media = result?.item
      if (!media?.publicUrl) throw new Error('BRAND_LOGO_MEDIA_UNAVAILABLE')
      onChange(media.publicUrl, {
        ...media,
        width: media.width ?? details.width,
        height: media.height ?? details.height,
        fileSize: media.fileSize ?? details.fileSize,
        mimeType: details.mimeType,
        logoQuality: brandLogoQualityFromDetails(details, warningIssues),
      })
      setExternalUrl('')
    } catch (uploadFailure) {
      setImportError(failureMessage(uploadFailure, t('brands.logo.errors.uploadFailed')))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="image-url-input">
      <div className="image-url-input-row">
        <Button variant="secondary" size="sm" className="image-url-pick-btn"
          type="button"
          onClick={() => { if (canReadMedia) setPickerOpen(true) }}
          disabled={disabled || !canReadMedia}
          title={!canReadMedia ? t('media.permissionDeniedDesc') : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
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
            <X size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
      {!canReadMedia ? (
        <small className="text-xs text-muted-foreground">
          {t('media.permissionDeniedDesc')}
        </small>
      ) : null}
      {isBrandLogo && canReadMedia && canWriteMedia ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="url"
            value={externalUrl}
            onChange={(event) => { setExternalUrl(event.target.value); setImportError('') }}
            placeholder={t('brands.logo.importUrlPlaceholder')}
            disabled={disabled || importing}
            aria-label={t('brands.logo.importUrlLabel')}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleExternalImport}
            disabled={disabled || importing || !externalUrl.trim()}
            className="shrink-0"
          >
            {importing ? t('brands.logo.importing') : t('brands.logo.importUrl')}
          </Button>
        </div>
      ) : null}
      {isBrandLogo && importError ? (
        <small className="field-error" role="alert">{importError}</small>
      ) : null}
      {isBrandLogo && importWarning ? (
        <small className="mt-1 block text-warning" role="status">{importWarning}</small>
      ) : null}
      {error && <small id={errorId} role="alert" className="field-error">{error}</small>}
      <MediaRequirementHint recommend={recommend} className="mt-1 text-xs text-muted-foreground" />
      <ImagePreview url={value} alt={previewAlt || alt} checkerboard={isBrandLogo} />

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
      {isBrandLogo && cropSource ? (
        <BrandLogoCropDialog
          open
          sourceUrl={cropSource.url}
          filename={cropSource.filename}
          sourceMimeType={cropSource.sourceMimeType}
          sourceTransparent={cropSource.sourceTransparent}
          onCancel={revokeCropSource}
          onComplete={handleCropComplete}
        />
      ) : null}
    </div>
  )
}
