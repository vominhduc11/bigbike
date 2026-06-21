import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { MediaPickerModal } from './MediaPickerModal'
import { VideoPickerModal } from './VideoPickerModal'
import { SortableList } from './Sortable'
import { cn, generateId } from '@/lib/utils'
import { CONTENT_MENU, PRODUCT_MENU, createBlock } from './block-editor/constants'
import { BlockCard } from './block-editor/blocks'

/**
 * BlockEditor — Notion-style block list editor for product descriptions.
 *
 * Props:
 *   value        — Block[] | null; null means no blocks (legacy HTML mode)
 *   onChange     — (Block[]) => void; called whenever blocks change
 *   disabled     — bool
 *   hasError     — bool
 *   fallbackHtml — string | undefined; legacy HTML shown when value is null/empty
 *   productMode  — bool; true ⇒ chỉ 4 khối cho mô tả sản phẩm (V238), mặc định đầy đủ (Content)
 */
export function BlockEditor({ value, onChange, disabled, hasError, fallbackHtml, productMode }) {
  const { t } = useTranslation()
  const blocks = value ?? []
  const menu = productMode ? PRODUCT_MENU : CONTENT_MENU

  const [mediaPickerIndex, setMediaPickerIndex] = useState(null)
  const [videoPickerIndex, setVideoPickerIndex] = useState(null)

  function addBlock(type, preset) {
    onChange([...blocks, createBlock(type, preset)])
  }

  function updateBlock(index, patch) {
    onChange(blocks.map((b, i) => i === index ? { ...b, ...patch } : b))
  }

  function removeBlock(index) {
    onChange(blocks.filter((_, i) => i !== index))
  }

  function duplicateBlock(index) {
    const copy = { ...blocks[index], _key: generateId() }
    const next = [...blocks]
    next.splice(index + 1, 0, copy)
    onChange(next)
  }

  const showFallback = blocks.length === 0 && fallbackHtml && fallbackHtml.trim().length > 0

  return (
    <div className={cn('flex flex-col gap-2', hasError && 'ring-1 ring-destructive rounded-sm')}>
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

      <SortableList
        items={blocks}
        getId={(b) => b._key}
        onReorder={(next) => onChange(next)}
        disabled={disabled}
        className="flex flex-col gap-2"
        renderItem={(block, sortable, index) => (
          <BlockCard
            sortable={sortable}
            block={block}
            disabled={disabled}
            productMode={productMode}
            onUpdate={(patch) => updateBlock(index, patch)}
            onRemove={() => removeBlock(index)}
            onDuplicate={() => duplicateBlock(index)}
            onPickImage={() => setMediaPickerIndex(index)}
            onPickVideo={() => setVideoPickerIndex(index)}
          />
        )}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled} className="self-start">
            + {t('products.detail.blocks.addBlock')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {menu.map((entry, i) => (
            <DropdownMenuItem key={`${entry.type}-${i}`} onClick={() => addBlock(entry.type, entry.preset)}>
              {t(entry.labelKey)}
            </DropdownMenuItem>
          ))}
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
