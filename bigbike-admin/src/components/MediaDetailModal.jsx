import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchMediaReferences, updateMedia } from '../lib/adminApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

const REFERENCE_TYPE_KEYS = {
  PRODUCT: 'media.referenceType.PRODUCT',
  PRODUCT_GALLERY: 'media.referenceType.PRODUCT_GALLERY',
  PRODUCT_VARIANT: 'media.referenceType.PRODUCT_VARIANT',
  PRODUCT_VARIANT_GALLERY: 'media.referenceType.PRODUCT_VARIANT_GALLERY',
  CATEGORY: 'media.referenceType.CATEGORY',
  BRAND: 'media.referenceType.BRAND',
  HOME_VIDEO: 'media.referenceType.HOME_VIDEO',
  CONTENT: 'media.referenceType.CONTENT',
  CONTENT_PRODUCT_IMG: 'media.referenceType.CONTENT_PRODUCT_IMG',
  CONTENT_SEO_OG: 'media.referenceType.CONTENT_SEO_OG',
  PAGE_SEO_OG: 'media.referenceType.PAGE_SEO_OG',
  SLIDER_DESKTOP: 'media.referenceType.SLIDER_DESKTOP',
  SLIDER_MOBILE: 'media.referenceType.SLIDER_MOBILE',
}

/**
 * Modal for editing altText / title / caption of a media item,
 * and displaying all places where this file is currently in use.
 */
export function MediaDetailModal({ media, onSave, onClose, onPreview }) {
  const { t } = useTranslation()
  const modalRef = useRef(null)
  const previousFocusRef = useRef(null)
  const [altText, setAltText] = useState(media.altText ?? '')
  const [title, setTitle] = useState(media.title ?? '')
  const [caption, setCaption] = useState(media.caption ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [refs, setRefs] = useState(media.references ?? [])
  const [refsLoading, setRefsLoading] = useState(false)

  const isImage = media.mimeType?.startsWith('image/')
  const isVideo = media.mimeType?.startsWith('video/')
  const isAudio = media.mimeType?.startsWith('audio/')

  useEffect(() => {
    // If references not already bundled in the list item, fetch separately
    if (media.references && media.references.length > 0) return
    if (media.usageCount === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefsLoading(true)
    fetchMediaReferences(media.id)
      .then(setRefs)
      .catch(() => {})
      .finally(() => setRefsLoading(false))
  }, [media.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const modal = modalRef.current
    const initialFocusTarget = modal?.querySelector(focusableSelector)
    if (initialFocusTarget) initialFocusTarget.focus()

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const currentModal = modalRef.current
      if (!currentModal) return
      const focusables = Array.from(currentModal.querySelectorAll(focusableSelector))
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [onClose])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await updateMedia(media.id, { altText, title, caption })
      onSave(result.item)
    } catch (err) {
      setError(err.message || t('media.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const usageCount = refs.length > 0 ? refs.length : (media.usageCount ?? 0)

  return (
    <>
      <div className="mpicker-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={modalRef} className="mpicker-modal max-w-[820px] w-full" role="dialog" aria-modal="true" aria-label={t('media.editTitle')}>
        <div className="mpicker-header">
          <h3 className="mpicker-title">{t('media.editTitle')}</h3>
          <Button variant="secondary" size="icon" type="button" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </Button>
        </div>

        <div className="mpicker-body flex flex-col gap-5 p-4">

          {/* Preview + form fields */}
          <div className="flex gap-5 flex-wrap">
            <div className="shrink-0 w-[360px] max-w-full flex flex-col gap-2">
              <div className="w-full h-[240px] bg-surface-muted rounded-md overflow-hidden flex items-center justify-center">
                {isImage && media.publicUrl ? (
                  <button
                    type="button"
                    onClick={() => onPreview && onPreview()}
                    aria-label={t('media.preview')}
                    className="w-full h-full flex items-center justify-center border-none p-0 bg-transparent"
                    style={{ cursor: onPreview ? 'zoom-in' : 'default' }}
                  >
                    <img src={media.publicUrl} alt={altText || ''} className="max-w-full max-h-full object-contain" />
                  </button>
                ) : isVideo && media.publicUrl ? (
                  <video src={media.publicUrl} controls className="w-full h-full object-contain bg-black" preload="metadata" />
                ) : isAudio && media.publicUrl ? (
                  <div className="w-full flex flex-col items-center gap-3 p-4">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                    <audio src={media.publicUrl} controls preload="metadata" className="w-full" />
                  </div>
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                )}
              </div>
              {onPreview && media.publicUrl && (isImage || isVideo || isAudio) && (
                <Button variant="secondary" type="button" onClick={() => onPreview()} className="w-full text-xs">
                  {t('media.preview')}
                </Button>
              )}
            </div>

            <form id="media-detail-form" onSubmit={handleSave} className="flex-1 min-w-[220px] flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold">{t('media.fieldAltText')}</span>
                <Input type="text" value={altText} onChange={(e) => setAltText(e.target.value)} placeholder={t('media.fieldAltTextPlaceholder')} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold">{t('media.fieldTitle')}</span>
                <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('media.fieldTitlePlaceholder')} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold">{t('media.fieldCaption')}</span>
                <Textarea rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('media.fieldCaptionPlaceholder')} className="resize-y" />
              </label>
              {error && <p className="text-danger text-xs m-0">{error}</p>}
            </form>
          </div>

          {/* Usage section */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-bold mb-2 flex items-center gap-2">
              {t('media.usageTitle')}
              {usageCount > 0
                ? <span className="bg-primary text-white rounded-full px-2 py-px text-[0.7rem] font-bold">{usageCount}</span>
                : <span className="bg-success text-white rounded-full px-2 py-px text-[0.7rem] font-semibold">{t('media.usageUnused')}</span>
              }
            </p>

            {refsLoading && (
              <p className="text-[0.78rem] text-muted-foreground">{t('common.loading')}</p>
            )}

            {!refsLoading && usageCount === 0 && (
              <p className="text-[0.78rem] text-muted-foreground">{t('media.usageNoneDesc')}</p>
            )}

            {!refsLoading && refs.length > 0 && (
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {refs.map((ref, i) => (
                  <li key={i} className="flex items-center gap-2 text-[0.78rem]">
                    <span className="bg-surface-muted border border-border rounded-xs px-1.5 py-px text-[0.68rem] font-semibold text-muted-foreground whitespace-nowrap shrink-0">
                      {REFERENCE_TYPE_KEYS[ref.type] ? t(REFERENCE_TYPE_KEYS[ref.type]) : ref.type}
                    </span>
                    {ref.adminPath ? (
                      <a
                        href={ref.adminPath}
                        className="text-primary no-underline truncate"
                        title={ref.name}
                      >
                        {ref.name}
                      </a>
                    ) : (
                      <span className="truncate" title={ref.name}>{ref.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

        <div className="mpicker-footer">
          <span className="text-xs text-muted-foreground truncate max-w-[260px]">
            {(media.filename ?? '').split('/').pop()}
          </span>
          <div className="mpicker-footer-actions">
            <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
            <Button type="submit" form="media-detail-form" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
