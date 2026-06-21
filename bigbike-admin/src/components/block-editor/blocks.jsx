import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GripVertical } from 'lucide-react'
import { MediaDimensionWarning } from '../MediaDimensionWarning'
import { RichTextEditor } from '../RichTextEditor'
import { IMAGE_RECO } from '../../lib/imageRecommendations'

export function BlockControls({ disabled, onDuplicate, onRemove }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="outline" size="icon" className="h-7 w-7"
        onClick={onDuplicate} disabled={disabled}
        aria-label={t('products.detail.blocks.duplicate')}>⎘</Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={onRemove} disabled={disabled}
        aria-label={t('products.detail.blocks.remove')}>✕</Button>
    </div>
  )
}

export function HeadingBlockEditor({ block, onChange, disabled }) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-2 flex-1">
      <Select value={String(block.level)} onValueChange={(v) => onChange({ level: Number(v) })} disabled={disabled}>
        <SelectTrigger className="w-44 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="2">{t('products.detail.blocks.headingLevel2')}</SelectItem>
          <SelectItem value="3">{t('products.detail.blocks.headingLevel3')}</SelectItem>
        </SelectContent>
      </Select>
      <Input
        className="flex-1 font-bold"
        placeholder={t('products.detail.blocks.headingTextPlaceholder')}
        value={block.text || ''}
        onChange={(e) => onChange({ text: e.target.value })}
        disabled={disabled}
        maxLength={500}
      />
    </div>
  )
}

export function ParagraphBlockEditor({ block, onChange, disabled }) {
  return (
    <div className="flex-1">
      <RichTextEditor
        key={block._key}
        value={block.html || ''}
        onChange={(html) => onChange({ html })}
        disabled={disabled}
        enableImagePicker
      />
    </div>
  )
}

export function ListBlockEditor({ block, onChange, disabled }) {
  const { t } = useTranslation()
  const items = block.items || ['']

  function updateItem(i, value) {
    const next = items.map((it, idx) => idx === i ? value : it)
    onChange({ items: next })
  }
  function addItem() {
    onChange({ items: [...items, ''] })
  }
  function removeItem(i) {
    const next = items.filter((_, idx) => idx !== i)
    onChange({ items: next.length === 0 ? [''] : next })
  }

  return (
    <div className="flex-1 flex flex-col gap-2">
      <Select value={block.style} onValueChange={(v) => onChange({ style: v })} disabled={disabled}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="bulleted">{t('products.detail.blocks.listStyleBulleted')}</SelectItem>
          <SelectItem value="numbered">{t('products.detail.blocks.listStyleNumbered')}</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1 items-center">
            <span className="text-muted-foreground text-sm w-5 text-center shrink-0">
              {block.style === 'numbered' ? `${i + 1}.` : '•'}
            </span>
            <Input
              className="flex-1"
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
              disabled={disabled}
              placeholder={t('products.detail.blocks.listItemPlaceholder')}
              maxLength={2000}
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
              onClick={() => removeItem(i)} disabled={disabled}
              aria-label={t('products.detail.blocks.listRemoveItem')}>✕</Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled} className="self-start">
        + {t('products.detail.blocks.listAddItem')}
      </Button>
    </div>
  )
}

export function ImageBlockEditor({ block, onChange, disabled, onPickImage }) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col gap-2">
      <div className="flex gap-2 items-start">
        {block.url ? (
          <div className="relative shrink-0">
            <img src={block.url} alt={block.alt || ''} className="h-24 w-36 object-cover rounded-sm border border-border" />
            <Button variant="outline" size="sm" className="mt-1 w-36 text-xs"
              onClick={onPickImage} disabled={disabled}>
              {t('products.detail.blocks.imageChange')}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={onPickImage} disabled={disabled} className="h-24 w-36 flex flex-col gap-1 text-xs">
            <span className="text-2xl">🖼</span>
            {t('products.detail.blocks.imagePick')}
          </Button>
        )}
        <div className="flex-1 flex flex-col gap-2">
          <Input
            placeholder={t('products.detail.blocks.imageAltPlaceholder')}
            value={block.alt || ''}
            onChange={(e) => onChange({ alt: e.target.value })}
            disabled={disabled}
            maxLength={500}
          />
          <Input
            placeholder={t('products.detail.blocks.imageCaptionPlaceholder')}
            value={block.caption || ''}
            onChange={(e) => onChange({ caption: e.target.value })}
            disabled={disabled}
            maxLength={500}
          />
        </div>
      </div>
      {block.url && <MediaDimensionWarning url={block.url} recommend={IMAGE_RECO.general} kind="image" />}
    </div>
  )
}

export function VideoBlockEditor({ block, onChange, disabled, onPickVideo }) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col gap-2">
      <Select value={block.provider} onValueChange={(v) => onChange({ provider: v, url: '' })} disabled={disabled}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="youtube">{t('products.detail.blocks.videoYouTube')}</SelectItem>
          <SelectItem value="upload">{t('products.detail.blocks.videoUpload')}</SelectItem>
        </SelectContent>
      </Select>
      {block.provider === 'youtube' ? (
        <Input
          placeholder={t('products.detail.blocks.videoUrlPlaceholder')}
          value={block.url || ''}
          onChange={(e) => onChange({ url: e.target.value })}
          disabled={disabled}
          maxLength={2000}
        />
      ) : (
        <div className="flex gap-2 items-center">
          <Input
            placeholder="URL video đã tải lên"
            value={block.url || ''}
            onChange={(e) => onChange({ url: e.target.value })}
            disabled={disabled}
            maxLength={2000}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={onPickVideo} disabled={disabled} className="shrink-0">
            {t('products.detail.blocks.videoPick')}
          </Button>
        </div>
      )}
      <Input
        placeholder={t('products.detail.blocks.videoCaptionPlaceholder')}
        value={block.caption || ''}
        onChange={(e) => onChange({ caption: e.target.value })}
        disabled={disabled}
        maxLength={500}
      />
      {block.provider === 'upload' && block.url && (
        <MediaDimensionWarning url={block.url} recommend={IMAGE_RECO.video} kind="video" />
      )}
    </div>
  )
}

export function CalloutBlockEditor({ block, onChange, disabled }) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col gap-2">
      <Select value={block.variant} onValueChange={(v) => onChange({ variant: v })} disabled={disabled}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="info">{t('products.detail.blocks.calloutVariantInfo')}</SelectItem>
          <SelectItem value="warning">{t('products.detail.blocks.calloutVariantWarning')}</SelectItem>
          <SelectItem value="note">{t('products.detail.blocks.calloutVariantNote')}</SelectItem>
        </SelectContent>
      </Select>
      <RichTextEditor
        key={block._key}
        value={block.html || ''}
        onChange={(html) => onChange({ html })}
        disabled={disabled}
        enableImagePicker={false}
      />
    </div>
  )
}

export function FeatureBlockEditor({ block, onChange, disabled, onPickImage, productMode }) {
  const { t } = useTranslation()
  const items = block.items || ['']

  function updateItem(i, value) {
    onChange({ items: items.map((it, idx) => idx === i ? value : it) })
  }
  function addItem() {
    onChange({ items: [...items, ''] })
  }
  function removeItem(i) {
    const next = items.filter((_, idx) => idx !== i)
    onChange({ items: next.length === 0 ? [''] : next })
  }

  // Sản phẩm: chỉ trái/phải (không "tự đảo"); Content: giữ cả auto.
  const sideValue = block.side === 'left' || block.side === 'right'
    ? block.side
    : (productMode ? 'right' : 'auto')

  return (
    <div className="flex-1 flex flex-col gap-3">
      {/* Vị trí ảnh */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">{t('products.detail.blocks.featureSideLabel')}</span>
        <Select value={sideValue} onValueChange={(v) => onChange({ side: v })} disabled={disabled}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {!productMode && <SelectItem value="auto">{t('products.detail.blocks.featureSideAuto')}</SelectItem>}
            <SelectItem value="left">{t('products.detail.blocks.featureSideLeft')}</SelectItem>
            <SelectItem value="right">{t('products.detail.blocks.featureSideRight')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ảnh + alt + caption */}
      <div className="flex gap-2 items-start">
        {block.url ? (
          <div className="relative shrink-0">
            <img src={block.url} alt={block.alt || ''} className="h-24 w-36 object-cover rounded-sm border border-border" />
            <Button variant="outline" size="sm" className="mt-1 w-36 text-xs"
              onClick={onPickImage} disabled={disabled}>
              {t('products.detail.blocks.imageChange')}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={onPickImage} disabled={disabled} className="h-24 w-36 flex flex-col gap-1 text-xs">
            <span className="text-2xl">🖼</span>
            {t('products.detail.blocks.imagePick')}
          </Button>
        )}
        <div className="flex-1 flex flex-col gap-2">
          <Input
            placeholder={t('products.detail.blocks.imageAltPlaceholder')}
            value={block.alt || ''}
            onChange={(e) => onChange({ alt: e.target.value })}
            disabled={disabled}
            maxLength={500}
          />
          <Input
            placeholder={t('products.detail.blocks.imageCaptionPlaceholder')}
            value={block.caption || ''}
            onChange={(e) => onChange({ caption: e.target.value })}
            disabled={disabled}
            maxLength={500}
          />
        </div>
      </div>
      {block.url && <MediaDimensionWarning url={block.url} recommend={IMAGE_RECO.general} kind="image" />}

      {/* Tiêu đề phụ (eyebrow) */}
      <Input
        className="text-xs uppercase tracking-wide text-primary"
        placeholder={t('products.detail.blocks.featureSubheadingPlaceholder')}
        value={block.subheading || ''}
        onChange={(e) => onChange({ subheading: e.target.value })}
        disabled={disabled}
        maxLength={500}
      />

      {/* Tiêu đề chính */}
      <Input
        className="font-bold"
        placeholder={t('products.detail.blocks.featureHeadingPlaceholder')}
        value={block.heading || ''}
        onChange={(e) => onChange({ heading: e.target.value })}
        disabled={disabled}
        maxLength={500}
      />

      {/* Đoạn mô tả */}
      <RichTextEditor
        key={block._key}
        value={block.html || ''}
        onChange={(html) => onChange({ html })}
        disabled={disabled}
        enableImagePicker={false}
      />

      {/* Danh sách điểm nổi bật */}
      <div className="flex flex-col gap-2">
        <Select value={block.listStyle || 'bulleted'} onValueChange={(v) => onChange({ listStyle: v })} disabled={disabled}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bulleted">{t('products.detail.blocks.listStyleBulleted')}</SelectItem>
            <SelectItem value="numbered">{t('products.detail.blocks.listStyleNumbered')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1">
          {items.map((item, i) => (
            <div key={i} className="flex gap-1 items-center">
              <span className="text-muted-foreground text-sm w-5 text-center shrink-0">
                {block.listStyle === 'numbered' ? `${i + 1}.` : '•'}
              </span>
              <Input
                className="flex-1"
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                disabled={disabled}
                placeholder={t('products.detail.blocks.listItemPlaceholder')}
                maxLength={2000}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                onClick={() => removeItem(i)} disabled={disabled}
                aria-label={t('products.detail.blocks.listRemoveItem')}>✕</Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={addItem} disabled={disabled} className="self-start">
          + {t('products.detail.blocks.listAddItem')}
        </Button>
      </div>
    </div>
  )
}

export function DividerBlockEditor() {
  return (
    <div className="flex-1 flex items-center py-2">
      <hr className="w-full border-border" />
    </div>
  )
}

/** Trình sửa danh sách chuỗi đơn giản (mỗi dòng một Input) — dùng cho ưu điểm / nhược điểm. */
export function StringListEditor({ items, onChange, disabled, placeholder, addLabel }) {
  const list = items && items.length ? items : ['']
  function updateItem(i, value) { onChange(list.map((it, idx) => (idx === i ? value : it))) }
  function addItem() { onChange([...list, '']) }
  function removeItem(i) {
    const next = list.filter((_, idx) => idx !== i)
    onChange(next.length === 0 ? [''] : next)
  }
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      {list.map((item, i) => (
        <div key={i} className="flex gap-1 items-center">
          <Input
            className="flex-1"
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            maxLength={2000}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
            onClick={() => removeItem(i)} disabled={disabled}
            aria-label={t('products.detail.blocks.listRemoveItem')}>✕</Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled} className="self-start">
        + {addLabel}
      </Button>
    </div>
  )
}

/** Khối "Phù hợp với ai" (V246) — tiêu đề tuỳ chọn + danh sách thẻ tư vấn. */
export function SuitabilityBlockEditor({ block, onChange, disabled }) {
  const { t } = useTranslation()
  const cards = block.cards && block.cards.length ? block.cards : [{ audience: '', advice: '', linkLabel: '', linkUrl: '' }]
  function updateCard(i, patch) { onChange({ cards: cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }) }
  function addCard() { onChange({ cards: [...cards, { audience: '', advice: '', linkLabel: '', linkUrl: '' }] }) }
  function removeCard(i) {
    const next = cards.filter((_, idx) => idx !== i)
    onChange({ cards: next.length === 0 ? [{ audience: '', advice: '', linkLabel: '', linkUrl: '' }] : next })
  }
  return (
    <div className="flex-1 flex flex-col gap-3">
      <Input
        className="font-bold"
        placeholder={t('products.detail.blocks.sectionTitlePlaceholder')}
        value={block.title || ''}
        onChange={(e) => onChange({ title: e.target.value })}
        disabled={disabled}
        maxLength={500}
      />
      {cards.map((card, i) => (
        <div key={i} className="flex flex-col gap-2 p-2 border border-border rounded-sm bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">#{i + 1}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => removeCard(i)} disabled={disabled}
              aria-label={t('products.detail.blocks.listRemoveItem')}>✕</Button>
          </div>
          <Input
            placeholder={t('products.detail.blocks.suitabilityAudiencePlaceholder')}
            value={card.audience || ''}
            onChange={(e) => updateCard(i, { audience: e.target.value })}
            disabled={disabled}
            maxLength={500}
          />
          <Input
            placeholder={t('products.detail.blocks.suitabilityAdvicePlaceholder')}
            value={card.advice || ''}
            onChange={(e) => updateCard(i, { advice: e.target.value })}
            disabled={disabled}
            maxLength={2000}
          />
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder={t('products.detail.blocks.suitabilityLinkLabelPlaceholder')}
              value={card.linkLabel || ''}
              onChange={(e) => updateCard(i, { linkLabel: e.target.value })}
              disabled={disabled}
              maxLength={500}
            />
            <Input
              className="flex-1"
              placeholder={t('products.detail.blocks.suitabilityLinkUrlPlaceholder')}
              value={card.linkUrl || ''}
              onChange={(e) => updateCard(i, { linkUrl: e.target.value })}
              disabled={disabled}
              maxLength={2000}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addCard} disabled={disabled} className="self-start">
        + {t('products.detail.blocks.suitabilityAddCard')}
      </Button>
    </div>
  )
}

/** Khối "Bảng size" (V246) — tiêu đề tuỳ chọn + HTML tự do (thường là bảng). */
export function SizeGuideBlockEditor({ block, onChange, disabled }) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col gap-2">
      <Input
        className="font-bold"
        placeholder={t('products.detail.blocks.sectionTitlePlaceholder')}
        value={block.title || ''}
        onChange={(e) => onChange({ title: e.target.value })}
        disabled={disabled}
        maxLength={500}
      />
      <RichTextEditor
        key={block._key}
        value={block.html || ''}
        onChange={(html) => onChange({ html })}
        disabled={disabled}
        enableImagePicker={false}
      />
    </div>
  )
}

export function BlockTypeLabel({ type }) {
  const { t } = useTranslation()
  const key = `products.detail.blocks.blockType${type.charAt(0).toUpperCase()}${type.slice(1)}`
  return (
    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-1">
      {t(key)}
    </span>
  )
}

export function BlockCard({ block, disabled, sortable, onUpdate, onRemove, onDuplicate, onPickImage, onPickVideo, productMode }) {
  const { t } = useTranslation()
  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.5 : undefined }}
      className="flex gap-2 p-3 border border-border rounded-sm bg-background hover:bg-muted/30 transition-colors"
    >
      {!disabled && sortable && (
        <button
          type="button"
          {...sortable.handleProps}
          className="shrink-0 self-start pt-1 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          title={t('products.detail.blocks.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })}
          aria-label={t('products.detail.blocks.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })}
        >
          <GripVertical size={16} />
        </button>
      )}
      <BlockTypeLabel type={block.type} />
      <div className="flex-1 min-w-0">
        {block.type === 'heading'   && <HeadingBlockEditor   block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'paragraph' && <ParagraphBlockEditor block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'list'      && <ListBlockEditor      block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'image'     && <ImageBlockEditor     block={block} onChange={onUpdate} disabled={disabled} onPickImage={onPickImage} />}
        {block.type === 'video'     && <VideoBlockEditor     block={block} onChange={onUpdate} disabled={disabled} onPickVideo={onPickVideo} />}
        {block.type === 'callout'   && <CalloutBlockEditor   block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'feature'   && <FeatureBlockEditor   block={block} onChange={onUpdate} disabled={disabled} onPickImage={onPickImage} productMode={productMode} />}
        {block.type === 'suitability' && <SuitabilityBlockEditor block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'sizeGuide'   && <SizeGuideBlockEditor   block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'divider'   && <DividerBlockEditor />}
      </div>
      <BlockControls
        disabled={disabled}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
      />
    </div>
  )
}
