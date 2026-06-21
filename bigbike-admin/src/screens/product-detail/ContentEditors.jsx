import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical } from 'lucide-react'
import { MediaPickerModal } from '../../components/MediaPickerModal'
import { VideoPickerModal } from '../../components/VideoPickerModal'
import { MediaDimensionWarning } from '../../components/MediaDimensionWarning'
import { IMAGE_RECO } from '../../lib/imageRecommendations'
import { RichTextEditor } from '../../components/RichTextEditor'
import { SortableList } from '../../components/Sortable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { generateId } from '@/lib/utils'
import { resolveDisplayUrl } from '@/lib/contracts'
import { extractYouTubeId, SECTION_VISIBILITY_KEYS, sectionHasContent } from './constants'

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
              onClick={() => onUpdate('provider', 'youtube')} disabled={disabled}>YouTube</Button>
            <Button type="button" variant={provider === 'upload' ? 'default' : 'ghost'} size="sm"
              onClick={() => { onUpdate('provider', 'upload'); }} disabled={disabled}>
              {t('products.detail.gallery.videoUpload', { defaultValue: 'Tải lên' })}
            </Button>
          </div>
          {provider === 'youtube' ? (
            <input
              type="text"
              className="gallery-card-alt-input"
              placeholder={t('products.detail.gallery.videoUrlPlaceholder', { defaultValue: 'Dán link YouTube' })}
              value={item.videoUrl || ''}
              onChange={(e) => onUpdate('videoUrl', e.target.value)}
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
          <input
            type="text"
            className="gallery-card-alt-input"
            placeholder={t('products.detail.gallery.altPlaceholder')}
            value={item.alt || ''}
            onChange={(e) => onUpdate('alt', e.target.value)}
            disabled={disabled}
            aria-label={t('products.detail.gallery.altAriaLabel')}
          />
          {urlError && <small className="field-error">{urlError}</small>}
        </div>
        {pickerOpen && (
          <MediaPickerModal
            onSelect={(url) => { onUpdate('url', url); setPickerOpen(false) }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {videoPickerOpen && (
          <VideoPickerModal
            onSelect={(url) => { onUpdate('videoUrl', url); onUpdate('provider', 'upload'); setVideoPickerOpen(false) }}
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
        <input
          type="text"
          className="gallery-card-alt-input"
          placeholder={t('products.detail.gallery.altPlaceholder')}
          value={item.alt || ''}
          onChange={(e) => onUpdate('alt', e.target.value)}
          disabled={disabled}
          aria-label={t('products.detail.gallery.altAriaLabel')}
        />
        {urlError && <small className="field-error">{urlError}</small>}
        {trimmed && <MediaDimensionWarning url={item.url} recommend={IMAGE_RECO.productImage} kind="image" />}
      </div>
      {pickerOpen && (
        <MediaPickerModal
          onSelect={(url) => { onUpdate('url', url); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

export function GalleryEditor({ items, onChange, disabled, validationErrors = {} }) {
  const { t } = useTranslation()

  function updateItem(index, field, value) {
    onChange(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }
  function removeItem(index) {
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
      <p className="text-xs text-muted-foreground mb-2">{t('products.detail.gallery.sizeHint')}</p>
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
            onUpdate={(field, value) => updateItem(index, field, value)}
            onRemove={() => removeItem(index)}
            disabled={disabled}
            urlError={validationErrors[`gallery.${index}.url`]}
          />
        )}
        footer={!disabled && (
          <button type="button" className="gallery-card-add" onClick={addItem}>
            <span className="gallery-add-icon">+</span>
            <span>{t('products.detail.gallery.addImage')}</span>
          </button>
        )}
      />
      {!disabled && (
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

  function updateItem(index, patch) {
    onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item))
  }
  function addItem() {
    onChange([...items, { url: '', title: '', description: '', type: 'youtube', thumbnailUrl: '' }])
  }
  function removeItem(index) {
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
          onSelect={(url) => {
            updateItem(pickerOpenIndex, { url, type: 'upload' })
            setPickerOpenIndex(null)
          }}
          onClose={() => setPickerOpenIndex(null)}
        />
      )}
    </div>
  )
}

export function SpecificationsEditor({ items, onChange, disabled, validationErrors, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fName = isEn ? 'nameEn' : 'name'
  const fValue = isEn ? 'valueEn' : 'value'
  function updateItem(index, field, value) {
    const next = items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    onChange(next)
  }
  function addItem() {
    onChange([...items, { _key: generateId(), name: '', value: '', groupName: '', nameEn: '', valueEn: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function moveItem(index, dir) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">{t('products.detail.specs.empty')}</p>
      )}
      {items.map((item, index) => {
        const errName = validationErrors?.[`specifications.${index}.name`]
        const errValue = validationErrors?.[`specifications.${index}.value`]
        return (
          <div key={item._key} className="list-editor-row list-editor-row--stack">
            <div className="list-editor-reorder">
              <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
              <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div>
                <Input className={errName ? 'border-danger' : undefined}
                  placeholder={t('products.detail.specs.namePlaceholder')}
                  aria-label={t('products.detail.specs.nameLabel')}
                  value={item[fName] || ''}
                  onChange={(e) => updateItem(index, fName, e.target.value)}
                  disabled={disabled}
                  maxLength={255}
                 />
                {errName && <small className="field-error">{errName}</small>}
              </div>
              <div>
                <Textarea className={errValue ? 'border-danger' : undefined}
                  placeholder={t('products.detail.specs.valuePlaceholder')}
                  aria-label={t('products.detail.specs.valueLabel')}
                  value={item[fValue] || ''}
                  onChange={(e) => updateItem(index, fValue, e.target.value)}
                  disabled={disabled}
                  rows={3}
                  maxLength={2000}
                 />
                {errValue && <small className="field-error">{errValue}</small>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeItem(index)}
              disabled={disabled}
              aria-label={t('products.detail.specs.removeSpec')}
            >
              ✕
            </Button>
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.specs.addSpec')}
      </Button>
    </div>
  )
}

/**
 * "Hiển thị trên web" (V245) — bảng công tắc bật/tắt các section nằm TRONG khối Tab của PDP
 * (Mô tả · Thông số · FAQ · Video · Đánh giá). Sản phẩm mới mặc định tắt hết. Các khối ngoài tab
 * không quản ở đây (web tự hiện khi có nội dung).
 */
export function SectionVisibilityEditor({ value, onChange, form, disabled }) {
  const { t } = useTranslation()
  const map = value || {}

  function toggle(key, on) {
    onChange({ ...map, [key]: on })
  }
  function setAll(on) {
    onChange(Object.fromEntries(SECTION_VISIBILITY_KEYS.map((k) => [k, on])))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setAll(true)} disabled={disabled}>
          {t('products.detail.sectionVisibility.showAll', { defaultValue: 'Bật tất cả' })}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAll(false)} disabled={disabled}>
          {t('products.detail.sectionVisibility.hideAll', { defaultValue: 'Tắt tất cả' })}
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {SECTION_VISIBILITY_KEYS.map((key) => {
          const on = map[key] === true
          const empty = !sectionHasContent(form, key)
          return (
            <div
              key={key}
              className="flex select-none items-center gap-3 rounded-sm border border-border px-3 py-2 text-sm"
            >
              <Checkbox
                checked={on}
                onCheckedChange={(v) => toggle(key, v === true)}
                disabled={disabled}
                id={`sv-${key}`}
              />
              <label htmlFor={`sv-${key}`} className="flex-1 cursor-pointer">
                {t(`products.detail.sectionVisibility.items.${key}`)}
              </label>
              {on && empty && (
                <span className="text-xs text-muted-foreground">
                  {t('products.detail.sectionVisibility.noContent', { defaultValue: 'chưa có nội dung' })}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
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
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function moveItem(index, dir) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="list-editor">
      {items.map((item, index) => (
        <div key={item._key} className="list-editor-row">
          <div className="list-editor-reorder">
            <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
            <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
          </div>
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
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {addLabel}
      </Button>
    </div>
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
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function moveItem(index, dir) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">{t('products.detail.faqs.empty')}</p>
      )}
      {items.map((item, index) => {
        const errQuestion = validationErrors?.[`faqs.${index}.question`]
        const errAnswer = validationErrors?.[`faqs.${index}.answer`]
        return (
          <div key={item._key} className="list-editor-row list-editor-row--stack">
            <div className="list-editor-reorder">
              <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
              <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
            </div>
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
      })}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.faqs.addFaq')}
      </Button>
    </div>
  )
}
