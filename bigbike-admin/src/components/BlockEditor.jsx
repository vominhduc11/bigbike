import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { MediaPickerModal } from './MediaPickerModal'
import { VideoPickerModal } from './VideoPickerModal'
import { RichTextEditor } from './RichTextEditor'
import { cn } from '@/lib/utils'

const BLOCK_TYPES = ['heading', 'paragraph', 'list', 'image', 'video', 'callout', 'divider']

function createBlock(type) {
  const base = { _key: crypto.randomUUID(), type }
  switch (type) {
    case 'heading':   return { ...base, level: 2, text: '' }
    case 'paragraph': return { ...base, html: '' }
    case 'list':      return { ...base, style: 'bulleted', items: [''] }
    case 'image':     return { ...base, url: '', alt: '', caption: '' }
    case 'video':     return { ...base, provider: 'youtube', url: '', caption: '' }
    case 'callout':   return { ...base, variant: 'info', html: '' }
    case 'divider':   return base
    default:          return base
  }
}

function BlockControls({ index, total, disabled, onMoveUp, onMoveDown, onDuplicate, onRemove }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="outline" size="icon" className="h-7 w-7"
        onClick={onMoveUp} disabled={disabled || index === 0}
        aria-label={t('products.detail.blocks.moveUp')}>▲</Button>
      <Button variant="outline" size="icon" className="h-7 w-7"
        onClick={onMoveDown} disabled={disabled || index === total - 1}
        aria-label={t('products.detail.blocks.moveDown')}>▼</Button>
      <Button variant="outline" size="icon" className="h-7 w-7"
        onClick={onDuplicate} disabled={disabled}
        aria-label={t('products.detail.blocks.duplicate')}>⎘</Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={onRemove} disabled={disabled}
        aria-label={t('products.detail.blocks.remove')}>✕</Button>
    </div>
  )
}

function HeadingBlockEditor({ block, onChange, disabled }) {
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

function ParagraphBlockEditor({ block, onChange, disabled }) {
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

function ListBlockEditor({ block, onChange, disabled }) {
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

function ImageBlockEditor({ block, onChange, disabled, onPickImage }) {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col gap-2">
      <div className="flex gap-2 items-start">
        {block.url ? (
          <div className="relative shrink-0">
            <img src={block.url} alt={block.alt || ''} className="h-24 w-36 object-cover rounded-none border border-border" />
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
    </div>
  )
}

function VideoBlockEditor({ block, onChange, disabled, onPickVideo }) {
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
    </div>
  )
}

function CalloutBlockEditor({ block, onChange, disabled }) {
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

function DividerBlockEditor() {
  return (
    <div className="flex-1 flex items-center py-2">
      <hr className="w-full border-border" />
    </div>
  )
}

function BlockTypeLabel({ type }) {
  const { t } = useTranslation()
  const key = `products.detail.blocks.blockType${type.charAt(0).toUpperCase()}${type.slice(1)}`
  return (
    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-1">
      {t(key)}
    </span>
  )
}

function BlockCard({ block, index, total, disabled, onUpdate, onRemove, onMoveUp, onMoveDown, onDuplicate, onPickImage, onPickVideo }) {
  return (
    <div className="flex gap-2 p-3 border border-border rounded-none bg-background hover:bg-muted/30 transition-colors">
      <BlockTypeLabel type={block.type} />
      <div className="flex-1 min-w-0">
        {block.type === 'heading'   && <HeadingBlockEditor   block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'paragraph' && <ParagraphBlockEditor block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'list'      && <ListBlockEditor      block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'image'     && <ImageBlockEditor     block={block} onChange={onUpdate} disabled={disabled} onPickImage={onPickImage} />}
        {block.type === 'video'     && <VideoBlockEditor     block={block} onChange={onUpdate} disabled={disabled} onPickVideo={onPickVideo} />}
        {block.type === 'callout'   && <CalloutBlockEditor   block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'divider'   && <DividerBlockEditor />}
      </div>
      <BlockControls
        index={index}
        total={total}
        disabled={disabled}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
      />
    </div>
  )
}

/**
 * BlockEditor — Notion-style block list editor for product descriptions.
 *
 * Props:
 *   value        — Block[] | null; null means no blocks (legacy HTML mode)
 *   onChange     — (Block[]) => void; called whenever blocks change
 *   disabled     — bool
 *   hasError     — bool
 *   fallbackHtml — string | undefined; legacy HTML shown when value is null/empty
 */
export function BlockEditor({ value, onChange, disabled, hasError, fallbackHtml }) {
  const { t } = useTranslation()
  const blocks = value ?? []

  const [mediaPickerIndex, setMediaPickerIndex] = useState(null)
  const [videoPickerIndex, setVideoPickerIndex] = useState(null)

  function addBlock(type) {
    onChange([...blocks, createBlock(type)])
  }

  function updateBlock(index, patch) {
    onChange(blocks.map((b, i) => i === index ? { ...b, ...patch } : b))
  }

  function removeBlock(index) {
    onChange(blocks.filter((_, i) => i !== index))
  }

  function moveBlock(index, dir) {
    const next = [...blocks]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function duplicateBlock(index) {
    const copy = { ...blocks[index], _key: crypto.randomUUID() }
    const next = [...blocks]
    next.splice(index + 1, 0, copy)
    onChange(next)
  }

  const showFallback = blocks.length === 0 && fallbackHtml && fallbackHtml.trim().length > 0

  return (
    <div className={cn('flex flex-col gap-2', hasError && 'ring-1 ring-destructive rounded-none')}>
      {showFallback && (
        <div className="border border-border p-3 bg-muted/40 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('products.detail.blocks.fallbackTitle')}
          </p>
          <div
            className="prose prose-sm max-w-none text-sm text-foreground"
            dangerouslySetInnerHTML={{ __html: fallbackHtml }}
          />
          <p className="text-xs text-muted-foreground">{t('products.detail.blocks.fallbackHint')}</p>
        </div>
      )}

      {blocks.length === 0 && !showFallback && (
        <p className="text-sm text-muted-foreground py-2">{t('products.detail.blocks.empty')}</p>
      )}

      {blocks.map((block, index) => (
        <BlockCard
          key={block._key}
          block={block}
          index={index}
          total={blocks.length}
          disabled={disabled}
          onUpdate={(patch) => updateBlock(index, patch)}
          onRemove={() => removeBlock(index)}
          onMoveUp={() => moveBlock(index, -1)}
          onMoveDown={() => moveBlock(index, 1)}
          onDuplicate={() => duplicateBlock(index)}
          onPickImage={() => setMediaPickerIndex(index)}
          onPickVideo={() => setVideoPickerIndex(index)}
        />
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled} className="self-start">
            + {t('products.detail.blocks.addBlock')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {BLOCK_TYPES.map((type) => {
            const key = `products.detail.blocks.blockType${type.charAt(0).toUpperCase()}${type.slice(1)}`
            return (
              <DropdownMenuItem key={type} onClick={() => addBlock(type)}>
                {t(key)}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {mediaPickerIndex !== null && (
        <MediaPickerModal
          onSelect={(url) => {
            updateBlock(mediaPickerIndex, { url })
            setMediaPickerIndex(null)
          }}
          onClose={() => setMediaPickerIndex(null)}
        />
      )}

      {videoPickerIndex !== null && (
        <VideoPickerModal
          onSelect={(url) => {
            updateBlock(videoPickerIndex, { url, provider: 'upload' })
            setVideoPickerIndex(null)
          }}
          onClose={() => setVideoPickerIndex(null)}
        />
      )}
    </div>
  )
}
