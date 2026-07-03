import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { generateId } from '@/lib/utils'
import { showConfirm } from '../../lib/confirm'
import { parseSpecsFromHtml, mergeSpecsIntoHtml } from '../../lib/specSheet'
import { resolveDisplayUrl } from '@/lib/contracts'
import { extractYouTubeId } from './constants'
import { useMediaAltSync, useMediaAltSyncList } from '@/lib/useMediaAltSync'

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

export function GalleryCard({ item, onUpdate, onRemove, disabled, urlError, sortable, showCover, isCover, onSetCover }) {
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
    const provider = item.provider || 'youtube'
    const ytId = provider === 'youtube' ? extractYouTubeId(item.videoUrl || '') : null
    const posterUrl = trimmed
      ? displayUrl
      : (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '')
    return (
      <div
        ref={sortable?.setNodeRef}
        style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : undefined }}
        className={`gallery-card${urlError ? ' gallery-card--error' : ''}`}
      >
        <div className="gallery-card-thumb relative bg-black">
          {posterUrl
            ? <img src={posterUrl} alt="" loading="eager" />
            : <span className="gallery-thumb-status">🎬</span>}
          <span className="absolute inset-0 flex items-center justify-center text-white text-2xl pointer-events-none">▶</span>
          {!disabled && sortable && (
            <button
              type="button"
              {...sortable.handleProps}
              className="absolute top-1 left-1 z-10 inline-flex items-center justify-center w-6 h-6 bg-black/55 text-white cursor-grab touch-none rounded-sm"
              onClick={(e) => e.stopPropagation()}
              title={dragLabel}
              aria-label={dragLabel}
            >
              <GripVertical size={14} />
            </button>
          )}
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
        <div className="gallery-card-body flex flex-col gap-2">
          <div className="flex gap-1 p-1 bg-muted w-fit">
            <Button type="button" variant={provider === 'youtube' ? 'default' : 'ghost'} size="sm"
              onClick={() => onUpdate({ provider: 'youtube' })} disabled={disabled}>YouTube</Button>
            <Button type="button" variant={provider === 'tiktok' ? 'default' : 'ghost'} size="sm"
              onClick={() => onUpdate({ provider: 'tiktok' })} disabled={disabled}>TikTok</Button>
            <Button type="button" variant={provider === 'facebook' ? 'default' : 'ghost'} size="sm"
              onClick={() => onUpdate({ provider: 'facebook' })} disabled={disabled}>Facebook</Button>
            <Button type="button" variant={provider === 'upload' ? 'default' : 'ghost'} size="sm"
              onClick={() => { onUpdate({ provider: 'upload' }); }} disabled={disabled}>
              {t('products.detail.gallery.videoUpload', { defaultValue: 'Tải lên' })}
            </Button>
          </div>
          {provider === 'youtube' ? (
            <input
              type="text"
              className="gallery-card-alt-input"
              placeholder={t('products.detail.gallery.videoUrlPlaceholder', { defaultValue: 'Dán link YouTube' })}
              value={item.videoUrl || ''}
              onChange={(e) => onUpdate({ videoUrl: e.target.value })}
              disabled={disabled}
            />
          ) : provider === 'tiktok' ? (
            <input
              type="text"
              className="gallery-card-alt-input"
              placeholder={t('products.detail.gallery.tiktokUrlPlaceholder', { defaultValue: 'Dán link TikTok đầy đủ' })}
              value={item.videoUrl || ''}
              onChange={(e) => onUpdate({ videoUrl: e.target.value })}
              disabled={disabled}
            />
          ) : provider === 'facebook' ? (
            <input
              type="text"
              className="gallery-card-alt-input"
              placeholder={t('products.detail.gallery.facebookUrlPlaceholder', { defaultValue: 'Dán link video Facebook (công khai)' })}
              value={item.videoUrl || ''}
              onChange={(e) => onUpdate({ videoUrl: e.target.value })}
              disabled={disabled}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setVideoPickerOpen(true)} disabled={disabled} className="self-start">
              {item.videoUrl ? t('products.detail.gallery.videoChange', { defaultValue: 'Đổi video' }) : t('products.detail.gallery.videoPick', { defaultValue: 'Chọn video' })}
            </Button>
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
              onUpdate({ url, alt: pickAlt(item.alt, media) })
              setPickerOpen(false)
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {videoPickerOpen && (
          <VideoPickerModal
            onSelect={(url) => { onUpdate({ videoUrl: url, provider: 'upload' }); setVideoPickerOpen(false) }}
            onClose={() => setVideoPickerOpen(false)}
          />
        )}
      </div>
    )
  }

  const thumbState = trimmed ? 'ok' : 'empty'

  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : undefined }}
      className={`gallery-card${urlError ? ' gallery-card--error' : ''}`}
    >
      <div
        className="gallery-card-thumb"
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setPickerOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && setPickerOpen(true)}
        aria-label={t('products.detail.gallery.pickImage')}
      >
        {thumbState === 'ok' && <img src={displayUrl} alt="" loading="eager" />}
        {thumbState === 'loading' && <span className="gallery-thumb-status">⋯</span>}
        {thumbState === 'error' && <span className="gallery-thumb-status gallery-thumb-error">!</span>}
        {thumbState === 'empty' && <span className="gallery-thumb-status">🖼</span>}
        {!disabled && sortable && (
          <button
            type="button"
            {...sortable.handleProps}
            className="absolute top-1 left-1 z-10 inline-flex items-center justify-center w-6 h-6 bg-black/55 text-white cursor-grab touch-none rounded-sm"
            onClick={(e) => e.stopPropagation()}
            title={dragLabel}
            aria-label={dragLabel}
          >
            <GripVertical size={14} />
          </button>
        )}
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
        {showCover && trimmed && (
          <button
            type="button"
            className={cn(
              'absolute bottom-1 right-1 z-10 inline-flex items-center justify-center w-6 h-6 rounded-sm',
              isCover ? 'bg-warning-bg text-warning' : 'bg-black/55 text-white',
              disabled && 'cursor-not-allowed',
            )}
            onClick={(e) => { e.stopPropagation(); if (!disabled) onSetCover() }}
            disabled={disabled}
            aria-pressed={isCover}
            title={isCover ? t('products.detail.gallery.isCoverImage') : t('products.detail.gallery.setCoverImage')}
            aria-label={isCover ? t('products.detail.gallery.isCoverImage') : t('products.detail.gallery.setCoverImage')}
          >
            <Star size={14} fill={isCover ? 'currentColor' : 'none'} />
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
        {urlError && <small className="field-error">{urlError}</small>}
      </div>
      {pickerOpen && (
        <MediaPickerModal
          recommend={IMAGE_RECO.productImage}
          kind="image"
          onSelect={(url, media) => {
            onUpdate({ url, alt: pickAlt(item.alt, media) })
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

export function GalleryEditor({ items, onChange, disabled, validationErrors = {}, allowVideo = true, showCover = false }) {
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
    // Ảnh đầu tiên của một gallery màu chưa từng chọn cover: tự đặt luôn làm đại
    // diện (không cần bấm sao) — chỉ khi thêm ảnh THỨ HAI trở đi mới thật sự cần
    // admin chọn tay (bắt buộc, xem lib/schemas.js superRefine).
    const autoCover = showCover && items.length === 0
    onChange([...items, { _key: generateId(), url: '', alt: '', isCover: autoCover }])
  }
  function addVideoItem() {
    onChange([...items, { _key: generateId(), mediaType: 'video', provider: 'youtube', videoUrl: '', url: '', alt: '' }])
  }
  function setCover(index) {
    onChange(items.map((item, i) => ({ ...item, isCover: i === index })))
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
            urlError={validationErrors[`gallery.${index}.url`]}
            showCover={showCover}
            isCover={Boolean(item.isCover)}
            onSetCover={() => setCover(index)}
          />
        )}
        footer={!disabled && (
          <button type="button" className="gallery-card-add" onClick={addItem}>
            <span className="gallery-add-icon">+</span>
            <span>{t('products.detail.gallery.addImage')}</span>
          </button>
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
    onChange([...items, { url: '', title: '', description: '', type: 'youtube', thumbnailUrl: '' }])
  }
  async function removeItem(index) {
    const hasContent = Boolean((items[index]?.url || '').trim())
    if (hasContent) {
      const confirmed = await showConfirm(t('products.detail.removeRowConfirmMessage'), t('products.detail.removeRowConfirmTitle'))
      if (!confirmed) return
    }
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
                  variant={type === 'tiktok' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateItem(index, { type: 'tiktok', url: '', thumbnailUrl: '' })}
                  disabled={disabled}
                >
                  TikTok
                </Button>
                <Button
                  type="button"
                  variant={type === 'facebook' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateItem(index, { type: 'facebook', url: '', thumbnailUrl: '' })}
                  disabled={disabled}
                >
                  Facebook
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
              ) : type === 'tiktok' ? (
                <div>
                  <Input className={urlError ? 'border-danger' : undefined}
                    placeholder={t('products.detail.video.tiktokPlaceholder')}
                    value={item.url}
                    onChange={(e) => updateItem(index, { url: e.target.value })}
                    disabled={disabled}
                  />
                  {urlError && <small className="field-error">{urlError}</small>}
                  <p className="mt-1 text-xs text-muted-foreground">{t('products.detail.video.tiktokHint')}</p>
                </div>
              ) : type === 'facebook' ? (
                <div>
                  <Input className={urlError ? 'border-danger' : undefined}
                    placeholder={t('products.detail.video.facebookPlaceholder')}
                    value={item.url}
                    onChange={(e) => updateItem(index, { url: e.target.value })}
                    disabled={disabled}
                  />
                  {urlError && <small className="field-error">{urlError}</small>}
                  <p className="mt-1 text-xs text-muted-foreground">{t('products.detail.video.facebookHint')}</p>
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
                </div>
              )}
              <Input
                placeholder={t('products.detail.video.titlePlaceholder')}
                value={item.title || ''}
                onChange={(e) => updateItem(index, { title: e.target.value })}
                onBlur={(e) => getMediaAltSync(index).flushAltSync(e.target.value)}
                disabled={disabled}
              />
              <Input
                placeholder={t('products.detail.video.descriptionPlaceholder')}
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
          onSelect={(url, media) => {
            const title = getMediaAltSync(pickerOpenIndex).pickAlt(items[pickerOpenIndex]?.title, media)
            updateItem(pickerOpenIndex, { url, type: 'upload', title })
            setPickerOpenIndex(null)
          }}
          onClose={() => setPickerOpenIndex(null)}
        />
      )}
    </div>
  )
}

/** HTML thông số có phải do trình nhập cấu trúc sinh ra không (để mở đúng tab mặc định). */
function isGeneratedSpecsHtml(html) {
  const h = (html || '').trim()
  if (!h) return true
  return h.includes('shop_attributes')
}

/**
 * Thông số kỹ thuật — `specificationsHtml` (theo ngôn ngữ) là NGUỒN DUY NHẤT được lưu & web render.
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
  const [rows, setRows] = useState(() => {
    const parsed = parseSpecsFromHtml(html)
    return parsed.length ? parsed : [newRow()]
  })

  // Ghi dòng → merge vào html (giữ CSS). html là field được lưu (qua onHtmlChange).
  function commit(nextRows) {
    setRows(nextRows)
    onHtmlChange?.(mergeSpecsIntoHtml(nextRows, html))
  }
  function changeMode(next) {
    if (next === mode) return
    // Vào tab có cấu trúc: nạp lại dòng từ html hiện tại (bỏ CSS, chỉ lấy chữ).
    if (next === 'structured') {
      const parsed = parseSpecsFromHtml(html)
      setRows(parsed.length ? parsed : [newRow()])
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
            <div>
              <Textarea
                placeholder={t('products.detail.specs.valuePlaceholder')}
                aria-label={t('products.detail.specs.valueLabel')}
                value={row.value || ''}
                onChange={(e) => updateRow(index, 'value', e.target.value)}
                disabled={disabled}
                rows={3}
                maxLength={2000}
               />
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
            ✕
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
          value={html || ''}
          onChange={(e) => onHtmlChange?.(e.target.value)}
          disabled={disabled}
          rows={10}
          maxLength={50000}
        />
        <p className="text-xs text-muted-foreground">{t('products.detail.specs.htmlHint')}</p>
        <AiHtmlBrief promptKey="products.detail.specs.aiBriefPrompt" />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('products.detail.specs.previewLabel')}
          </label>
          {(html || '').trim() ? (
            <div
              className="size-guide-preview rounded-sm border border-border bg-surface p-3 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          ) : (
            <p className="list-editor-empty">{t('products.detail.specs.previewEmpty')}</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}

/** Ưu/Nhược điểm (V175) — danh sách câu ngắn, song ngữ inline. Dùng chung cho cả
 *  hai nhóm; nhãn/placeholder truyền qua props. */
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
    <SortableList
      items={items}
      getId={(it) => it._key}
      onReorder={(next) => onChange(next)}
      disabled={disabled}
      className="list-editor"
      renderItem={(item, sortable, index) => (
        <div ref={sortable.setNodeRef} style={sortable.style} className="list-editor-row">
          <DragHandle handleProps={sortable.handleProps} disabled={disabled} label={t('products.detail.dragToReorder')} />
          <div className="flex-1">
            <Input
              placeholder={placeholder}
              value={item[fContent] || ''}
              onChange={(e) => updateItem(index, e.target.value)}
              disabled={disabled}
              maxLength={2000}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeItem(index)}
            disabled={disabled}
            aria-label={t('products.detail.highlights.remove', { defaultValue: 'Xóa mục' })}
          >
            ✕
          </Button>
        </div>
      )}
      footer={
        <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
          + {addLabel}
        </Button>
      }
    />
  )
}

export function FaqEditor({ items, onChange, disabled, validationErrors, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fQuestion = isEn ? 'questionEn' : 'question'
  const fAnswer = isEn ? 'answerEn' : 'answer'
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

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">{t('products.detail.faqs.empty')}</p>
      )}
      <SortableList
        items={items}
        getId={(it) => it._key}
        onReorder={(next) => onChange(next)}
        disabled={disabled}
        className="list-editor"
        renderItem={(item, sortable, index) => {
        const errQuestion = validationErrors?.[`faqs.${index}.question`]
        const errAnswer = validationErrors?.[`faqs.${index}.answer`]
        return (
          <div ref={sortable.setNodeRef} style={sortable.style} className="list-editor-row list-editor-row--stack">
            <DragHandle handleProps={sortable.handleProps} disabled={disabled} label={t('products.detail.dragToReorder')} />
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
              disabled={disabled}
              aria-label={t('products.detail.faqs.removeFaq')}
            >
              ✕
            </Button>
          </div>
        )
      }}
        footer={
          <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
            + {t('products.detail.faqs.addFaq')}
          </Button>
        }
      />
    </div>
  )
}
