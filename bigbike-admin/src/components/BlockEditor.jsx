import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { MediaPickerModal } from './MediaPickerModal'
import { VideoPickerModal } from './VideoPickerModal'
import { SortableList } from './Sortable'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { cn, generateId } from '@/lib/utils'
import { CONTENT_MENU, PRODUCT_MENU, createBlock, nextProductFeatureSide } from './block-editor/constants'
import { BlockCard } from './block-editor/blocks'
import { showConfirm } from '@/lib/confirm'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { useMediaAltSyncList } from '@/lib/useMediaAltSync'

const BLOCK_META_KEYS = new Set(['_key', 'type', 'level', 'style', 'side', 'variant', 'provider'])

function blockHasContent(block) {
  return Object.entries(block || {}).some(([key, value]) => {
    if (BLOCK_META_KEYS.has(key)) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) {
      return value.some((item) => {
        if (typeof item === 'string') return item.trim().length > 0
        if (item && typeof item === 'object') {
          return Object.values(item).some((v) => typeof v === 'string' && v.trim().length > 0)
        }
        return Boolean(item)
      })
    }
    return false
  })
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
 *   showFallbackHtml — bool; false hides the legacy HTML reference block
 *   productMode  — bool; true ⇒ chỉ 4 khối cho mô tả sản phẩm (V238), mặc định đầy đủ (Content)
 *   contentLang  — 'vi' | 'en'; 'en' ⇒ mỗi khối hiện field *En (không đổi cấu trúc — thêm/xóa/kéo
 *                  thả khối bị khóa, giống FaqEditor). Mặc định 'vi' nên chỗ dùng cho Content không
 *                  cần truyền (không song ngữ).
 */
export function BlockEditor({ value, onChange, disabled, hasError, fallbackHtml, showFallbackHtml = true, productMode, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const blocks = value ?? []
  const menu = productMode ? PRODUCT_MENU : CONTENT_MENU
  const isEn = contentLang === 'en'
  const structDisabled = disabled || isEn

  const [mediaPickerIndex, setMediaPickerIndex] = useState(null)
  const [videoPickerIndex, setVideoPickerIndex] = useState(null)
  const getMediaAltSync = useMediaAltSyncList()
  // Trạng thái thu gọn per-khối (P2-19) — chỉ ở UI, keyed theo _key. KHÔNG đưa vào
  // model lưu (_key đã bị strip trước khi lưu) nên không làm bẩn payload/contract.
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set())

  function addBlock(type, preset) {
    onChange([...blocks, createBlock(type, preset)])
  }

  function toggleCollapsed(key) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function updateBlock(index, patch) {
    onChange(blocks.map((b, i) => i === index ? { ...b, ...patch } : b))
  }

  async function removeBlock(index) {
    if (blockHasContent(blocks[index])) {
      const confirmed = await showConfirm(t('products.detail.blocks.removeConfirmMessage'), t('products.detail.blocks.removeConfirmTitle'))
      if (!confirmed) return
    }
    onChange(blocks.filter((_, i) => i !== index))
  }

  function duplicateBlock(index) {
    const copy = { ...blocks[index], _key: generateId() }
    const next = [...blocks]
    next.splice(index + 1, 0, copy)
    onChange(next)
  }

  // Chèn khối mới ngay dưới khối hiện tại (P2-19) — cùng khuôn splice như duplicate.
  function insertBlock(index, type, preset) {
    const next = [...blocks]
    next.splice(index + 1, 0, createBlock(type, preset))
    onChange(next)
  }

  const hasFallback = showFallbackHtml && Boolean(fallbackHtml && fallbackHtml.trim().length > 0)

  // Gợi ý so le tự động cho khối cuối (productMode) — chỉ gợi ý UX, giá trị lưu vẫn 'left'/'right'
  // tường minh (xem nextProductFeatureSide trong constants.js).
  const suggestedAppendEntry = productMode
    ? menu.find((m) => m.preset?.side === nextProductFeatureSide(blocks[blocks.length - 1]?.side)) ?? menu[0]
    : null

  return (
    <div className={cn('flex flex-col gap-2', hasError && 'ring-1 ring-destructive rounded-sm')}>
      {hasFallback && (
        <div className="border border-border p-3 bg-muted/40 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('products.detail.blocks.fallbackTitle')}
          </p>
          <div
            className="prose prose-sm max-w-none text-sm text-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(fallbackHtml) }}
          />
          <p className="text-xs text-muted-foreground">
            {blocks.length > 0
              ? t('products.detail.blocks.fallbackReplacedHint', { defaultValue: 'Nội dung cũ ở trên sẽ được thay bằng các khối bên dưới sau khi lưu.' })
              : t('products.detail.blocks.fallbackHint')}
          </p>
        </div>
      )}

      {blocks.length === 0 && !hasFallback && (
        <p className="text-sm text-muted-foreground py-2">{t('products.detail.blocks.empty')}</p>
      )}

      <SortableList
        items={blocks}
        getId={(b) => b._key}
        onReorder={(next) => onChange(next)}
        disabled={structDisabled}
        className="flex flex-col gap-2"
        renderItem={(block, sortable, index) => (
          <BlockCard
            sortable={sortable}
            block={block}
            disabled={disabled}
            structDisabled={structDisabled}
            contentLang={contentLang}
            productMode={productMode}
            collapsed={collapsedKeys.has(block._key)}
            onToggleCollapse={() => toggleCollapsed(block._key)}
            insertMenu={menu}
            onInsertBelow={(type, preset) => insertBlock(index, type, preset)}
            onUpdate={(patch) => updateBlock(index, patch)}
            onRemove={() => removeBlock(index)}
            onDuplicate={() => duplicateBlock(index)}
            onPickImage={() => setMediaPickerIndex(index)}
            onPickVideo={() => setVideoPickerIndex(index)}
            onAltBlur={(value) => getMediaAltSync(index).flushAltSync(value)}
          />
        )}
      />

      {productMode ? (
        <Button
          variant="outline" size="sm" disabled={structDisabled} className="self-start"
          onClick={() => addBlock(suggestedAppendEntry.type, suggestedAppendEntry.preset)}
        >
          + {t(suggestedAppendEntry.labelKey)}
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={structDisabled} className="self-start">
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
      )}

      {mediaPickerIndex !== null && (
        <MediaPickerModal
          recommend={blocks[mediaPickerIndex]?.type === 'feature' ? IMAGE_RECO.featureImage : IMAGE_RECO.general}
          kind="image"
          onSelect={(url, media) => {
            const alt = getMediaAltSync(mediaPickerIndex).pickAlt(blocks[mediaPickerIndex]?.alt, media)
            updateBlock(mediaPickerIndex, { url, alt })
            setMediaPickerIndex(null)
          }}
          onClose={() => setMediaPickerIndex(null)}
        />
      )}

      {videoPickerIndex !== null && (
        <VideoPickerModal
          recommend={IMAGE_RECO.contentVideo}
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
