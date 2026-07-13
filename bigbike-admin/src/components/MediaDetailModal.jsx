import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateMedia } from '../lib/adminApi'
import { useMediaReferences } from '../lib/useMediaReferences'
import { showConfirm } from '../lib/confirm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconClose } from './media-picker/pickerIcons'
import { REFERENCE_TYPE_KEYS } from './media-picker/pickerUtils'
import { useModalFocusTrap, useBodyScrollLock } from './media-picker/useModalBehavior'


/**
 * Modal for editing altText / title of a media item,
 * and displaying all places where this file is currently in use.
 */
export function MediaDetailModal({ media, onSave, onClose, onPreview }) {
  const { t } = useTranslation()
  const modalRef = useRef(null)
  const [altText, setAltText] = useState(media.altText ?? '')
  const [title, setTitle] = useState(media.title ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { refs, refsLoading } = useMediaReferences(media)

  const isImage = media.mimeType?.startsWith('image/')
  const isVideo = media.mimeType?.startsWith('video/')
  const isAudio = media.mimeType?.startsWith('audio/')

  // Chỉ bật nút Lưu và hỏi trước khi đóng khi thật sự có thay đổi.
  const dirty = altText !== (media.altText ?? '') || title !== (media.title ?? '')

  const attemptClose = useCallback(async () => {
    if (dirty) {
      const ok = await showConfirm(
        t('media.discardConfirm'),
        t('media.discardConfirmTitle'),
      )
      if (!ok) return
    }
    onClose()
  }, [dirty, onClose, t])

  // Focus-trap + Escape + khoá scroll nền dùng chung (thay cho bản tự dựng).
  // Escape đi qua attemptClose để không bỏ mất thay đổi chưa lưu.
  useModalFocusTrap({ modalRef, onClose: attemptClose })
  useBodyScrollLock()

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await updateMedia(media.id, { altText, title })
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
      <div className="mpicker-backdrop" onClick={attemptClose} aria-hidden="true" />
      <div ref={modalRef} className="mpicker-modal max-w-[820px] w-full" role="dialog" aria-modal="true" aria-label={t('media.editTitle')}>
        <div className="mpicker-header">
          <h3 className="mpicker-title">{t('media.editTitle')}</h3>
          <Button variant="secondary" size="icon" type="button" onClick={attemptClose} aria-label={t('common.close')}>
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
              {error && <p className="text-danger text-xs m-0">{error}</p>}
            </form>
          </div>

          {/* Usage section */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-bold mb-2 flex items-center gap-2">
              {t('media.usageTitle')}
              {usageCount > 0
                ? <span className="bg-primary text-white rounded-full px-2 py-px text-xs font-bold">{usageCount}</span>
                : <span className="bg-success text-white rounded-full px-2 py-px text-xs font-semibold">{t('media.usageUnused')}</span>
              }
            </p>

            {refsLoading && (
              <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
            )}

            {!refsLoading && usageCount === 0 && (
              <p className="text-xs text-muted-foreground">{t('media.usageNoneDesc')}</p>
            )}

            {!refsLoading && refs.length > 0 && (
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {refs.map((ref, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className="bg-surface-muted border border-border rounded-xs px-1.5 py-px text-xs font-semibold text-muted-foreground whitespace-nowrap shrink-0">
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
            <Button variant="secondary" type="button" onClick={attemptClose} disabled={saving}>{t('common.cancel')}</Button>
            <Button type="submit" form="media-detail-form" disabled={saving || !dirty}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
