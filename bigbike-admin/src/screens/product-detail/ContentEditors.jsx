import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Film, GripVertical, ImageIcon, Play, Plus, X } from 'lucide-react'
import { MediaPickerModal } from '../../components/MediaPickerModal'
import { VideoPickerModal } from '../../components/VideoPickerModal'
import { MediaRequirementHint } from '../../components/MediaRequirementHint'
import { IMAGE_RECO } from '../../lib/imageRecommendations'
import { RichTextEditor } from '../../components/RichTextEditor'
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import AiHtmlBrief from '../../components/AiHtmlBrief'
import { SortableList, DragHandle } from '../../components/Sortable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn, generateId } from '@/lib/utils'
import { showConfirm } from '../../lib/confirm'
import { parseSpecsFromHtml, parseSpecsResult, mergeSpecsIntoHtml } from '../../lib/specSheet'
import { parseHighlightsPairResult, mergeHighlightsPairHtmlIntoItems, serializeHighlightsPairToHtml } from '../../lib/highlightsBlock'
import { parseFaqsResult, mergeFaqsHtmlIntoItems, serializeFaqsToHtml } from '../../lib/faqsBlock'
import { resolveDisplayUrl } from '@/lib/contracts'
import { extractYouTubeId } from './constants'
import { useMediaAltSync, useMediaAltSyncList } from '@/lib/useMediaAltSync'
import { HtmlImportNotice } from '../../components/HtmlImportNotice'
import { useHtmlImportDraft } from '../../lib/useHtmlImportDraft'

export function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconChevronUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

export function GalleryCard({ item, onUpdate, onRemove, disabled, urlError, sortable }) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)
  const { pickAlt } = useMediaAltSync()
  const isVideo = item.mediaType === 'video'
  const trimmed = (item.url || '').trim()
  const displayUrl = resolveDisplayUrl(trimmed)
  const dragLabel = t('products.detail.gallery.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })

  // ── KHỐI VIDEO trong gallery (V248): YouTube/Upload + thumbnail tuỳ chọn ──
  if (isVideo) {
    const provider = item.provider || ((item.videoUrl || '').trim() ? '' : 'youtube')
    const ytId = provider === 'youtube' ? extractYouTubeId(item.videoUrl || '') : null
    const posterUrl = trimmed
      ? displayUrl
      : (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '')
    const changeProvider = async (nextProvider) => {
      if (provider === nextProvider) return
      if ((item.videoUrl || '').trim()) {
        const confirmed = await showConfirm(
          t('products.detail.video.switchProviderConfirm'),
          t('products.detail.video.switchProviderTitle'),
        )
        if (!confirmed) return
      }
      onUpdate({ provider: nextProvider, videoUrl: '' })
    }
    return (
      <div
        ref={sortable?.setNodeRef}
        style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : undefined }}
        className={`gallery-card${urlError ? ' gallery-card--error' : ''}`}
      >
        <div className="gallery-card-thumb relative bg-black">
          {posterUrl
            ? <img src={posterUrl} alt="" loading="eager" />
            : <span className="gallery-thumb-status"><Film size={22} aria-hidden="true" /></span>}
          <span className="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
            <Play size={28} fill="currentColor" aria-hidden="true" />
          </span>
          {!disabled && sortable && (
            <Button variant="unstyled"
              type="button"
              {...sortable.handleProps}
              className="absolute top-1 left-1 z-10 inline-flex items-center justify-center w-6 h-6 bg-black/55 text-white cursor-grab touch-none rounded-sm"
              onClick={(e) => e.stopPropagation()}
              title={dragLabel}
              aria-label={dragLabel}
            >
              <GripVertical size={14} />
            </Button>
          )}
          {!disabled && (
            <Button variant="unstyled"
              type="button"
              className="gallery-card-remove"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              aria-label={t('products.detail.gallery.removeImage')}
            >
              <X size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
        <div className="gallery-card-body flex flex-col gap-2">
          <div className="flex gap-1 p-1 bg-muted w-fit">
            <Button type="button" variant={provider === 'youtube' ? 'default' : 'ghost'} size="sm"
              onClick={() => { void changeProvider('youtube') }} disabled={disabled}>YouTube</Button>
            <Button type="button" variant={provider === 'upload' ? 'default' : 'ghost'} size="sm"
              onClick={() => { void changeProvider('upload') }} disabled={disabled}>
              {t('products.detail.gallery.videoUpload', { defaultValue: 'Tải lên' })}
            </Button>
          </div>
          {provider === 'youtube' ? (
            <Input
              type="text"
              placeholder={t('products.detail.gallery.videoUrlPlaceholder', { defaultValue: 'Dán link YouTube' })}
              value={item.videoUrl || ''}
              onChange={(e) => onUpdate({ videoUrl: e.target.value })}
              disabled={disabled}
            />
          ) : provider === 'upload' ? (
            <div className="flex flex-col gap-1">
              <Button variant="outline" size="sm" onClick={() => setVideoPickerOpen(true)} disabled={disabled} className="self-start">
                {item.videoUrl ? t('products.detail.gallery.videoChange', { defaultValue: 'Đổi video' }) : t('products.detail.gallery.videoPick', { defaultValue: 'Chọn video' })}
              </Button>
              <MediaRequirementHint recommend={IMAGE_RECO.video} />
            </div>
          ) : (
            <div className="rounded-sm border border-warning-border bg-warning-bg p-3 text-sm text-warning" role="alert">
              {t('products.detail.gallery.legacySourceWarning')}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} disabled={disabled} className="self-start">
            {trimmed ? t('products.detail.gallery.thumbChange', { defaultValue: 'Đổi ảnh đại diện' }) : t('products.detail.gallery.thumbPick', { defaultValue: 'Ảnh đại diện (tuỳ chọn)' })}
          </Button>
          {urlError && <small className="field-error">{urlError}</small>}
        </div>
        {pickerOpen && (
          <MediaPickerModal
            recommend={IMAGE_RECO.productImage}
            kind="image"
            onSelect={(url, media) => {
              onUpdate({
                url,
                alt: pickAlt(item.alt, media),
                width: media?.width ?? null,
                height: media?.height ?? null,
                mimeType: media?.mimeType ?? null,
              })
              setPickerOpen(false)
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {videoPickerOpen && (
          <VideoPickerModal
            recommend={IMAGE_RECO.video}
            onSelect={(url) => { onUpdate({ videoUrl: url, provider: 'upload' }); setVideoPickerOpen(false) }}
            onClose={() => setVideoPickerOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : undefined }}
      className={`gallery-card${urlError ? ' gallery-card--error' : ''}`}
    >
      {/* Thumb chỉ để xem — mở picker qua nút bên dưới (tránh lồng nút trong nút, a11y). */}
      <div className="gallery-card-thumb">
        {trimmed
          ? <img src={displayUrl} alt="" loading="eager" />
          : <span className="gallery-thumb-status"><ImageIcon size={22} aria-hidden="true" /></span>}
        {!disabled && sortable && (
          <Button variant="unstyled"
            type="button"
            {...sortable.handleProps}
            className="absolute top-1 left-1 z-10 inline-flex items-center justify-center w-6 h-6 bg-black/55 text-white cursor-grab touch-none rounded-sm"
            onClick={(e) => e.stopPropagation()}
            title={dragLabel}
            aria-label={dragLabel}
          >
            <GripVertical size={14} />
          </Button>
        )}
        {!disabled && (
          <Button variant="unstyled"
            type="button"
            className="gallery-card-remove"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            aria-label={t('products.detail.gallery.removeImage')}
          >
            <X size={14} aria-hidden="true" />
          </Button>
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
        {urlError && <small className="field-error">{urlError}</small>}
      </div>
      {pickerOpen && (
        <MediaPickerModal
          recommend={IMAGE_RECO.productImage}
          kind="image"
          onSelect={(url, media) => {
            onUpdate({
              url,
              alt: pickAlt(item.alt, media),
              width: media?.width ?? null,
              height: media?.height ?? null,
              mimeType: media?.mimeType ?? null,
            })
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

export function GalleryEditor({ items, onChange, disabled, validationErrors = {}, allowVideo = true }) {
  const { t } = useTranslation()

  function updateItem(index, patch) {
    onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item))
  }
  async function removeItem(index) {
    const item = items[index]
    const hasContent = Boolean((item?.url || item?.videoUrl || '').trim())
    if (hasContent) {
      const confirmed = await showConfirm(t('products.detail.removeRowConfirmMessage'), t('products.detail.removeRowConfirmTitle'))
      if (!confirmed) return
    }
    onChange(items.filter((_, i) => i !== index))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), url: '', alt: '' }])
  }
  function addVideoItem() {
    onChange([...items, { _key: generateId(), mediaType: 'video', provider: 'youtube', videoUrl: '', url: '', alt: '' }])
  }


  return (
    <div className="gallery-editor">
      <MediaRequirementHint recommend={IMAGE_RECO.productImage} className="mb-2" />
      <SortableList
        items={items}
        getId={(it) => it._key}
        onReorder={(next) => onChange(next)}
        disabled={disabled}
        layout="grid"
        className="gallery-grid"
        renderItem={(item, sortable, index) => (
          <GalleryCard
            sortable={sortable}
            item={item}
            onUpdate={(patch) => updateItem(index, patch)}
            onRemove={() => removeItem(index)}
            disabled={disabled}
            urlError={validationErrors[`gallery.${index}.videoUrl`] || validationErrors[`gallery.${index}.url`]}
          />
        )}
        footer={!disabled && (
          <Button variant="unstyled" type="button" className="gallery-card-add" onClick={addItem}>
            <span className="gallery-add-icon"><Plus size={20} aria-hidden="true" /></span>
            <span>{t('products.detail.gallery.addImage')}</span>
          </Button>
        )}
      />
      {!disabled && allowVideo && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addVideoItem}
            title={t('products.detail.gallery.addVideoTitle', { defaultValue: 'Thêm video vào dải ảnh sản phẩm' })}
          >
            + {t('products.detail.gallery.addVideo', { defaultValue: 'Thêm video' })}
          </Button>
        </div>
      )}
    </div>
  )
}

export function VideoEditor({ items, onChange, disabled, validationErrors = {} }) {
  const { t } = useTranslation()
  const [pickerOpenIndex, setPickerOpenIndex] = useState(null)
  const getMediaAltSync = useMediaAltSyncList()

  function updateItem(index, patch) {
    onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), url: '', title: '', description: '', type: 'youtube', thumbnailUrl: '' }])
  }
  async function removeItem(index) {
    const hasContent = Boolean((items[index]?.url || '').trim())
    if (hasContent) {
      const confirmed = await showConfirm(t('products.detail.removeRowConfirmMessage'), t('products.detail.removeRowConfirmTitle'))
      if (!confirmed) return
    }
    onChange(items.filter((_, i) => i !== index))
  }
  // Đổi nguồn video (YouTube/Thư viện) phải xoá liên kết cũ vì mỗi nguồn có định
  // dạng khác nhau — hỏi xác nhận khi ô đang có link để không xoá mất dữ liệu ngoài ý muốn.
  async function changeType(index, nextType) {
    const item = items[index]
    if (item?.type === nextType) return
    if ((item?.url || '').trim()) {
      const confirmed = await showConfirm(
        t('products.detail.video.switchProviderConfirm', { defaultValue: 'Đổi nguồn video sẽ xóa liên kết đã nhập. Bạn có chắc muốn tiếp tục?' }),
        t('products.detail.video.switchProviderTitle', { defaultValue: 'Đổi nguồn video' }),
      )
      if (!confirmed) return
    }
    updateItem(index, nextType === 'upload'
      ? { type: 'upload', url: '' }
      : { type: nextType, url: '', thumbnailUrl: '' })
  }

  return (
    <div className="list-editor">
      {items.map((item, index) => {
        const type = item.type || ((item.url || '').trim() ? '' : 'youtube')
        const urlError = validationErrors[`videos.${index}.url`]
        const ytId = type === 'youtube' ? extractYouTubeId(item.url) : null
        return (
          // Khoá ổn định: dùng _key gán lúc thêm; item cũ (chưa có _key) rơi về index —
          // đều KHÔNG đổi khi gõ link nên con trỏ không nhảy (audit P1-10). Trước đây khoá
          // theo item.url (chính ô đang gõ) làm React remount dòng sau mỗi ký tự.
          <div key={item._key ?? `video-${index}`} className="list-editor-row">
            <div className="list-editor-fields">
              <div className="flex gap-1 p-1 bg-muted w-fit">
                <Button
                  type="button"
                  variant={type === 'youtube' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => changeType(index, 'youtube')}
                  disabled={disabled}
                >
                  YouTube
                </Button>
                <Button
                  type="button"
                  variant={type === 'upload' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => changeType(index, 'upload')}
                  disabled={disabled}
                >
                  {t('products.detail.video.fromLibrary')}
                </Button>
              </div>

              {type === 'youtube' ? (
                <div>
                  <Input className={urlError  ? 'border-danger' : undefined}
                    placeholder={t('products.detail.video.youtubePlaceholder')}
                    aria-label={t('products.detail.video.urlLabel', { defaultValue: 'Liên kết video' })}
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
              ) : type === 'upload' ? (
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
                        <X size={14} aria-hidden="true" />
                      </Button>
                    )}
                    {item.url && (
                      <span className="truncate max-w-xs text-xs text-muted-foreground">
                        <Check size={14} aria-hidden="true" /> {item.url.split('/').pop()}
                      </span>
                    )}
                  </div>
                  <MediaRequirementHint recommend={IMAGE_RECO.video} className="mt-1" />
                  {urlError && <small className="field-error">{urlError}</small>}
                  {item.url && (
                    <video
                      src={`${item.url}#t=0.001`}
                      controls
                      preload="metadata"
                      className="mt-2 w-full max-w-xs h-auto rounded border border-border"
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-sm border border-warning-border bg-warning-bg p-3 text-sm text-warning" role="alert">
                  {t('products.detail.video.legacySourceWarning')}
                  {urlError && <small className="mt-1 block field-error">{urlError}</small>}
                </div>
              )}
              <Input
                placeholder={t('products.detail.video.titlePlaceholder')}
                aria-label={t('products.detail.video.titleLabel', { defaultValue: 'Tiêu đề video' })}
                value={item.title || ''}
                onChange={(e) => updateItem(index, { title: e.target.value })}
                onBlur={(e) => getMediaAltSync(item._key ?? index).flushAltSync(e.target.value)}
                disabled={disabled}
              />
              <Input
                placeholder={t('products.detail.video.descriptionPlaceholder')}
                aria-label={t('products.detail.video.descriptionLabel', { defaultValue: 'Mô tả video' })}
                value={item.description || ''}
                onChange={(e) => updateItem(index, { description: e.target.value })}
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
              <X size={14} aria-hidden="true" />
            </Button>
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.video.addVideo')}
      </Button>
      {pickerOpenIndex !== null && (
        <VideoPickerModal
          recommend={IMAGE_RECO.video}
          onSelect={(url, media) => {
            const item = items[pickerOpenIndex]
            const title = getMediaAltSync(item?._key ?? pickerOpenIndex).pickAlt(item?.title, media)
            updateItem(pickerOpenIndex, { url, type: 'upload', title })
            setPickerOpenIndex(null)
          }}
          onClose={() => setPickerOpenIndex(null)}
        />
      )}
    </div>
  )
}

/**
 * HTML thông số có phải do trình nhập cấu trúc sinh ra không (để mở đúng tab mặc định).
 * `bb-specs-grouped` (V329 backfill) đánh dấu bảng có hàng tiêu đề nhóm (colspan 2) — model
 * cấu trúc ở đây KHÔNG có khái niệm nhóm nên parse/merge sẽ làm phẳng mất tiêu đề; buộc mở tab
 * "Mã HTML" (giữ nguyên, không parse) thay vì "Có cấu trúc" để tránh mất phân nhóm khi lưu.
 */
function isGeneratedSpecsHtml(html) {
  const h = (html || '').trim()
  if (!h) return true
  if (h.includes('bb-specs-grouped')) return false
  return h.includes('shop_attributes')
}

/**
 * Thông số kỹ thuật — `specifications` (theo ngôn ngữ) là NGUỒN DUY NHẤT được lưu & web render.
 * Tab "Có cấu trúc" chỉ là công cụ nhập: mỗi thay đổi dòng tên/giá trị được GHÉP vào html hiện có
 * (giữ nguyên CSS/markup, chỉ đổi chữ). HTML → Cấu trúc (chuyển tab): parse html ra dòng (bỏ CSS).
 * Cho phép CSS inline khi dán HTML. Component được key theo contentLang ở screen nên đổi ngôn ngữ =
 * remount + nạp lại theo html ngôn ngữ đó.
 */
export function SpecificationsEditor({ disabled, html = '', onHtmlChange }) {
  const { t } = useTranslation()
  const newRow = () => ({ _key: generateId(), name: '', value: '' })
  const [mode, setMode] = useState(() =>
    ((html || '').trim() && !isGeneratedSpecsHtml(html)) ? 'html' : 'structured',
  )
  const importer = useHtmlImportDraft(html, parseSpecsResult)
  const { draftHtml, result, dirty, pending, updateDraft, commitDraft, runApply } = importer
  const [rows, setRows] = useState(() => {
    const parsed = parseSpecsFromHtml(html)
    return parsed.length ? parsed : [newRow()]
  })
  // `html` có thể đến muộn (vd sau khi trang tải xong dữ liệu sản phẩm import từ CSV/JSON) — lúc
  // đó `rows` đã lỡ khởi tạo rỗng từ trước và không tự nạp lại. Theo dõi html "bên ngoài" (khác với
  // html do chính commit() vừa ghi lên) để nạp lại rows, tránh tab "Có cấu trúc" đứng hình trống.
  const lastHtmlRef = useRef(html)
  useEffect(() => {
    if (html === lastHtmlRef.current) return
    lastHtmlRef.current = html
    const parsed = parseSpecsFromHtml(html)
    setRows(parsed.length ? parsed : [newRow()])
  }, [html])

  // Ghi dòng → merge vào html (giữ CSS). html là field được lưu (qua onHtmlChange).
  function commit(nextRows) {
    setRows(nextRows)
    const nextHtml = mergeSpecsIntoHtml(nextRows, html)
    lastHtmlRef.current = nextHtml
    onHtmlChange?.(nextHtml)
  }

  async function applyParsed() {
    await runApply(async ({ draftHtml: nextDraft, result: parsed }) => {
      if (!parsed.acceptedCount) return null
      const confirmed = await showConfirm(
        t('products.detail.htmlImport.confirmMessage', { count: parsed.acceptedCount, skipped: parsed.skippedCount }),
        t('products.detail.htmlImport.confirmTitle'),
        {
          variant: 'default',
          confirmLabel: t('products.detail.htmlImport.confirmApply'),
          cancelLabel: t('products.detail.htmlImport.confirmCancel'),
        },
      )
      if (!confirmed) return null
      const nextHtml = mergeSpecsIntoHtml(parsed.items, nextDraft)
      setRows(parsed.items.length ? parsed.items : [newRow()])
      lastHtmlRef.current = nextHtml
      onHtmlChange?.(nextHtml)
      setMode('structured')
      return { sourceHtml: nextHtml }
    })
  }

  async function applyRaw() {
    if (!dirty || !draftHtml.trim()) return
    await runApply(async ({ draftHtml: nextDraft }) => {
      const confirmed = await showConfirm(
        t('products.detail.htmlImport.rawConfirmMessage'),
        t('products.detail.htmlImport.rawConfirmTitle'),
        {
          variant: 'default',
          confirmLabel: t('products.detail.htmlImport.confirmApply'),
          cancelLabel: t('products.detail.htmlImport.confirmCancel'),
        },
      )
      if (!confirmed) return null
      lastHtmlRef.current = nextDraft
      onHtmlChange?.(nextDraft)
      setMode('html')
      return { sourceHtml: nextDraft }
    })
  }

  async function changeMode(next) {
    if (next === mode) return
    if (next === 'structured') {
      if (dirty) {
        await applyParsed()
        return
      }
      const parsed = parseSpecsResult(html)
      if (html.trim() && !parsed.acceptedCount) return
      setRows(parsed.items.length ? parsed.items : [newRow()])
    } else {
      commitDraft(html)
    }
    setMode(next)
  }
  function updateRow(index, field, value) {
    commit(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }
  function addRow() { commit([...rows, newRow()]) }
  async function removeRow(index) {
    const row = rows[index]
    const hasContent = Boolean((row?.name || row?.value || '').trim())
    if (hasContent) {
      const confirmed = await showConfirm(t('products.detail.removeRowConfirmMessage'), t('products.detail.removeRowConfirmTitle'))
      if (!confirmed) return
    }
    const next = rows.filter((_, i) => i !== index)
    commit(next.length === 0 ? [newRow()] : next)
  }

  return (
    <Tabs value={mode} onValueChange={changeMode}>
      <TabsList>
        <TabsTrigger value="structured" disabled={disabled}>{t('products.detail.specs.modeStructured')}</TabsTrigger>
        <TabsTrigger value="html" disabled={disabled}>{t('products.detail.specs.modeHtml')}</TabsTrigger>
      </TabsList>

      <TabsContent value="structured">
    <SortableList
      items={rows}
      getId={(it) => it._key}
      onReorder={(next) => commit(next)}
      disabled={disabled}
      className="list-editor"
      renderItem={(row, sortable, index) => (
        <div
          ref={sortable.setNodeRef}
          style={sortable.style}
          className="list-editor-row list-editor-row--stack"
        >
          <DragHandle handleProps={sortable.handleProps} disabled={disabled} label={t('products.detail.dragToReorder')} />
          <div className="flex flex-1 flex-col gap-2">
            <div>
              <Input
                placeholder={t('products.detail.specs.namePlaceholder')}
                aria-label={t('products.detail.specs.nameLabel')}
                value={row.name || ''}
                onChange={(e) => updateRow(index, 'name', e.target.value)}
                disabled={disabled}
                maxLength={255}
               />
            </div>
            <div className="flex flex-col gap-1">
              <RichTextEditor
                key={`spec-value-${row._key}`}
                value={row.value || ''}
                onChange={(value) => updateRow(index, 'value', value)}
                placeholder={t('products.detail.specs.valuePlaceholder')}
                disabled={disabled}
                inlineOnly
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {t('products.detail.specs.valueFormatHint')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeRow(index)}
            disabled={disabled}
            aria-label={t('products.detail.specs.removeSpec')}
          >
            <X size={14} aria-hidden="true" />
          </Button>
        </div>
      )}
      footer={
        <Button variant="outline" size="sm" onClick={addRow} disabled={disabled}>
          + {t('products.detail.specs.addSpec')}
        </Button>
      }
    />
      </TabsContent>

      <TabsContent value="html" className="flex flex-col gap-2">
        <Textarea
          className="font-mono text-xs"
          placeholder={t('products.detail.specs.htmlPlaceholder')}
          value={draftHtml}
          onChange={(e) => updateDraft(e.target.value)}
          disabled={disabled || pending}
          rows={10}
          maxLength={50000}
        />
        <p className="text-xs text-muted-foreground">{t('products.detail.specs.htmlHint')}</p>
        <HtmlImportNotice
          result={result}
          dirty={dirty}
          disabled={disabled || pending}
          onApply={applyParsed}
          onUseRaw={applyRaw}
          allowRaw
          extraNotice={result.extraColumnCount > 0 ? t('products.detail.htmlImport.extraColumns', { count: result.extraColumnCount }) : null}
        />
        <AiHtmlBrief promptKey="products.detail.specs.aiBriefPrompt" />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('products.detail.specs.previewLabel')}
          </label>
          {draftHtml.trim() ? (
            <div
              className="size-guide-preview rounded-sm border border-border bg-surface p-3 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(draftHtml) }}
            />
          ) : (
            <p className="list-editor-empty">{t('products.detail.specs.previewEmpty')}</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}

/** Xem trước khối Ưu/Nhược điểm ở chế độ "Dán mã HTML" — dựng lại ĐÚNG layout thẻ màu mà
 *  bigbike-web thật sự render (ProductProsCons: viền trên + nền nhạt theo màu, icon Check/X),
 *  thay vì đổ thẳng HTML thô ra (không có màu/icon, không giống thật). Đọc trực tiếp từ
 *  positiveNotes/negativeNotes hiện có — luôn khớp dữ liệu, không phụ thuộc rawHtml. */
function HighlightsCardsPreview({ positiveNotes, negativeNotes, isEn, prosLabel, consLabel }) {
  const field = isEn ? 'contentEn' : 'content'
  const pros = (positiveNotes || []).map((n) => (n?.[field] || '').trim()).filter(Boolean)
  const cons = (negativeNotes || []).map((n) => (n?.[field] || '').trim()).filter(Boolean)
  if (pros.length === 0 && cons.length === 0) return null

  const card = (tone, label, list) => {
    const isPositive = tone === 'positive'
    return (
    <div className={cn('border-t-2 p-5', isPositive ? 'border-success bg-success/10' : 'border-danger bg-danger/10')}>
      <h3 className={cn('mb-3 text-base font-bold uppercase tracking-wide', isPositive ? 'text-success' : 'text-danger')}>
        {label}
      </h3>
      <ul className="flex list-none flex-col gap-2 p-0">
        {list.map((html, i) => (
          <li key={i} className={cn('flex gap-2 text-base', !isPositive && 'text-muted-foreground')}>
            {isPositive
              ? <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
              : <X size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />}
            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
          </li>
        ))}
      </ul>
    </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {pros.length > 0 && card('positive', prosLabel, pros)}
      {cons.length > 0 && card('negative', consLabel, cons)}
    </div>
  )
}

/** Xem trước khối FAQ ở chế độ "Dán mã HTML" — dựng lại accordion số thứ tự (01, 02…) giống
 *  bigbike-web thật (PdpSection FAQ), thay vì đổ thẳng câu hỏi/trả lời dạng đoạn văn thường.
 *  Dùng <details>/<summary> để có sẵn hành vi đóng/mở mà không cần thêm state. */
function FaqAccordionPreview({ items, isEn }) {
  const fQuestion = isEn ? 'questionEn' : 'question'
  const fAnswer = isEn ? 'answerEn' : 'answer'
  const rows = (items || [])
    .map((item) => ({ question: (item?.[fQuestion] || '').trim(), answer: (item?.[fAnswer] || '').trim() }))
    .filter((row) => row.question || row.answer)
  if (rows.length === 0) return null

  return (
    <div className="faq-accordion-preview border-t border-border">
      {rows.map((row, i) => (
        <details key={i} open={i === 0} className="border-b border-border">
          <summary className="flex cursor-pointer items-center justify-between gap-3 py-3 text-foreground">
            <span className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-base font-bold tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-base font-semibold">{row.question}</span>
            </span>
            <ChevronDown className="faq-chevron shrink-0 text-muted-foreground" size={16} aria-hidden="true" />
          </summary>
          <div
            className="pb-3 ps-9 text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(row.answer) }}
          />
        </details>
      ))}
    </div>
  )
}

/** Ưu/Nhược điểm (V175) — danh sách câu ngắn, song ngữ inline. Dùng chung cho cả
 *  hai nhóm; nhãn/placeholder truyền qua props. Chỉ dùng ở chế độ "Nhập có cấu trúc" —
 *  chế độ "Dán mã HTML" dùng chung 1 khối cho cả 2 nhóm, xem [[HighlightsHtmlEditor]]. */
export function HighlightsEditor({ items, onChange, disabled, contentLang = 'vi', placeholder, addLabel }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fContent = isEn ? 'contentEn' : 'content'
  function updateItem(index, value) {
    onChange(items.map((item, i) => (i === index ? { ...item, [fContent]: value } : item)))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), content: '', contentEn: '' }])
  }
  async function removeItem(index) {
    const hasContent = Boolean((items[index]?.[fContent] || '').trim())
    if (hasContent) {
      const confirmed = await showConfirm(t('products.detail.removeRowConfirmMessage'), t('products.detail.removeRowConfirmTitle'))
      if (!confirmed) return
    }
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <>
      {items.length === 0 && isEn && (
        <p className="list-editor-empty">{t('products.detail.highlights.addInViFirst', { defaultValue: 'Thêm mục ở tab Tiếng Việt trước, rồi quay lại đây để dịch.' })}</p>
      )}
      <SortableList
        items={items}
        getId={(it) => it._key}
        onReorder={(next) => onChange(next)}
        disabled={disabled}
        className="list-editor"
        renderItem={(item, sortable, index) => (
          <div ref={sortable.setNodeRef} style={sortable.style} className="list-editor-row">
            <DragHandle handleProps={sortable.handleProps} disabled={disabled || isEn} label={t('products.detail.dragToReorder')} />
            <div className="flex-1">
              <Input
                placeholder={placeholder}
                value={item[fContent] || ''}
                onChange={(e) => updateItem(index, e.target.value)}
                disabled={disabled}
                maxLength={20000}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeItem(index)}
              disabled={disabled || isEn}
              aria-label={t('products.detail.highlights.remove', { defaultValue: 'Xóa mục' })}
            >
              <X size={14} aria-hidden="true" />
            </Button>
          </div>
        )}
        footer={!isEn && (
          <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
            + {addLabel}
          </Button>
        )}
      />
    </>
  )
}

/** Ưu/Nhược điểm — chế độ "Dán mã HTML": MỘT khối mã cho cả Ưu điểm lẫn Nhược điểm cùng
 *  lúc (2 vùng .bb-highlights-pros/.bb-highlights-cons bên trong), gõ xong tách ngay về
 *  positiveNotes/negativeNotes tương ứng — không tạo trường HTML riêng để lưu. */
export function HighlightsHtmlEditor({ positiveNotes, negativeNotes, onChangePositive, onChangeNegative, disabled, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const labels = { prosLabel: t('products.detail.highlights.prosTitle'), consLabel: t('products.detail.highlights.consTitle') }
  const sourceHtml = serializeHighlightsPairToHtml(positiveNotes, negativeNotes, isEn, labels)
  const importer = useHtmlImportDraft(sourceHtml, parseHighlightsPairResult)
  const { draftHtml, result, dirty, pending, updateDraft, runApply } = importer

  async function applyParsed() {
    await runApply(async ({ draftHtml: nextDraft, result: parsed }) => {
      if (!parsed.acceptedCount) return null
      const confirmed = await showConfirm(
        t('products.detail.htmlImport.confirmMessage', { count: parsed.acceptedCount, skipped: parsed.skippedCount }),
        t('products.detail.htmlImport.confirmTitle'),
        {
          variant: 'default',
          confirmLabel: t('products.detail.htmlImport.confirmApply'),
          cancelLabel: t('products.detail.htmlImport.confirmCancel'),
        },
      )
      if (!confirmed) return null
      const next = mergeHighlightsPairHtmlIntoItems(positiveNotes, negativeNotes, nextDraft, isEn)
      onChangePositive(next.positiveNotes)
      onChangeNegative(next.negativeNotes)
      return {
        sourceHtml: serializeHighlightsPairToHtml(next.positiveNotes, next.negativeNotes, isEn, labels),
      }
    })
  }

  const isEmptyEn = isEn && positiveNotes.length === 0 && negativeNotes.length === 0

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        className="font-mono text-xs"
        placeholder={t('products.detail.highlights.htmlPlaceholder')}
        aria-label={t('products.detail.highlights.modeHtml')}
        value={draftHtml}
        onChange={(event) => updateDraft(event.target.value)}
        disabled={disabled || isEmptyEn || pending}
        rows={14}
      />
      <p className="text-xs text-muted-foreground">{t('products.detail.highlights.htmlHint')}</p>
      <HtmlImportNotice
        result={result}
        dirty={dirty}
        disabled={disabled || isEmptyEn || pending}
        onApply={applyParsed}
        extraNotice={t('products.detail.htmlImport.arraySource')}
      />
      <AiHtmlBrief promptKey="products.detail.highlights.aiBriefPrompt" />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t('products.detail.highlights.previewLabel')}
        </label>
        {draftHtml.trim() ? (
          <div className="size-guide-preview rounded-sm border border-border bg-surface p-3 overflow-x-auto">
            <HighlightsCardsPreview
              positiveNotes={positiveNotes}
              negativeNotes={negativeNotes}
              isEn={isEn}
              prosLabel={labels.prosLabel}
              consLabel={labels.consLabel}
            />
          </div>
        ) : (
          <p className="list-editor-empty">{t('products.detail.highlights.previewEmpty')}</p>
        )}
      </div>
    </div>
  )
}

export function FaqEditor({ items, onChange, disabled, validationErrors, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fQuestion = isEn ? 'questionEn' : 'question'
  const fAnswer = isEn ? 'answerEn' : 'answer'
  const [mode, setMode] = useState('structured')
  const sourceHtml = serializeFaqsToHtml(items, isEn)
  const importer = useHtmlImportDraft(sourceHtml, parseFaqsResult)
  const { draftHtml, result, dirty, pending, updateDraft, commitDraft, runApply } = importer

  function updateItem(index, field, value) {
    const next = items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    onChange(next)
  }
  function addItem() {
    onChange([...items, { _key: generateId(), question: '', answer: '', questionEn: '', answerEn: '' }])
  }
  async function removeItem(index) {
    const item = items[index]
    const hasContent = Boolean((item?.[fQuestion] || item?.[fAnswer] || '').trim())
    if (hasContent) {
      const confirmed = await showConfirm(t('products.detail.removeRowConfirmMessage'), t('products.detail.removeRowConfirmTitle'))
      if (!confirmed) return
    }
    onChange(items.filter((_, i) => i !== index))
  }
  async function applyParsed() {
    return runApply(async ({ draftHtml: nextDraft, result: parsed }) => {
      if (!parsed.acceptedCount) return null
      const confirmed = await showConfirm(
        t('products.detail.htmlImport.confirmMessage', { count: parsed.acceptedCount, skipped: parsed.skippedCount }),
        t('products.detail.htmlImport.confirmTitle'),
        {
          variant: 'default',
          confirmLabel: t('products.detail.htmlImport.confirmApply'),
          cancelLabel: t('products.detail.htmlImport.confirmCancel'),
        },
      )
      if (!confirmed) return null
      const nextItems = mergeFaqsHtmlIntoItems(items, nextDraft, isEn)
      onChange(nextItems)
      return { sourceHtml: serializeFaqsToHtml(nextItems, isEn) }
    })
  }

  async function changeMode(next) {
    if (next === mode) return
    if (next === 'html') {
      commitDraft(sourceHtml)
    } else if (dirty) {
      const applied = await applyParsed()
      if (applied?.sourceHtml !== undefined) setMode(next)
      return
    } else if (sourceHtml.trim() && !parseFaqsResult(sourceHtml).acceptedCount) {
      return
    }
    setMode(next)
  }

  return (
    <Tabs value={mode} onValueChange={changeMode}>
      <TabsList>
        <TabsTrigger value="structured" disabled={disabled}>{t('products.detail.faqs.modeStructured')}</TabsTrigger>
        <TabsTrigger value="html" disabled={disabled}>{t('products.detail.faqs.modeHtml')}</TabsTrigger>
      </TabsList>

      <TabsContent value="structured">
        <div className="list-editor">
          {items.length === 0 && (
            <p className="list-editor-empty">
              {isEn ? t('products.detail.faqs.addInViFirst', { defaultValue: 'Thêm câu hỏi ở tab Tiếng Việt trước, rồi quay lại đây để dịch.' }) : t('products.detail.faqs.empty')}
            </p>
          )}
          <SortableList
            items={items}
            getId={(it) => it._key}
            onReorder={(next) => onChange(next)}
            disabled={disabled || isEn}
            className="list-editor"
            renderItem={(item, sortable, index) => {
              const errQuestion = validationErrors?.[`faqs.${index}.question`]
              const errAnswer = validationErrors?.[`faqs.${index}.answer`]
              return (
                <div ref={sortable.setNodeRef} style={sortable.style} className="list-editor-row list-editor-row--stack">
                  <DragHandle handleProps={sortable.handleProps} disabled={disabled || isEn} label={t('products.detail.dragToReorder')} />
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
                      <RichTextEditor
                        key={`faq-answer-${item._key}-${contentLang}`}
                        value={item[fAnswer] || ''}
                        onChange={(html) => updateItem(index, fAnswer, html)}
                        placeholder={t('products.detail.faqs.answerPlaceholder')}
                        disabled={disabled}
                        hasError={Boolean(errAnswer)}
                      />
                      {errAnswer && <small className="field-error">{errAnswer}</small>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeItem(index)}
                    disabled={disabled || isEn}
                    aria-label={t('products.detail.faqs.removeFaq')}
                  >
                    <X size={14} aria-hidden="true" />
                  </Button>
                </div>
              )
            }}
            footer={!isEn && (
              <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
                + {t('products.detail.faqs.addFaq')}
              </Button>
            )}
          />
        </div>
      </TabsContent>

      <TabsContent value="html" className="flex flex-col gap-2">
        <Textarea
          className="font-mono text-xs"
          placeholder={t('products.detail.faqs.htmlPlaceholder')}
          aria-label={t('products.detail.faqs.modeHtml')}
          value={draftHtml}
          onChange={(event) => updateDraft(event.target.value)}
          disabled={disabled || (isEn && items.length === 0) || pending}
          rows={10}
        />
        <p className="text-xs text-muted-foreground">{t('products.detail.faqs.htmlHint')}</p>
        <HtmlImportNotice
          result={result}
          dirty={dirty}
          disabled={disabled || (isEn && items.length === 0) || pending}
          onApply={applyParsed}
          extraNotice={t('products.detail.htmlImport.arraySource')}
        />
        <AiHtmlBrief promptKey="products.detail.faqs.aiBriefPrompt" />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('products.detail.faqs.previewLabel')}
          </label>
          {draftHtml.trim() ? (
            <div className="size-guide-preview rounded-sm border border-border bg-surface p-3 overflow-x-auto">
              <FaqAccordionPreview items={items} isEn={isEn} />
            </div>
          ) : (
            <p className="list-editor-empty">{t('products.detail.faqs.previewEmpty')}</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
