import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GripVertical } from 'lucide-react'
import { RichTextEditor } from '../RichTextEditor'
import { RichTextEditorWithSource } from '../RichTextEditorWithSource'
import { generateId } from '@/lib/utils'
import { parseSizeGuide, serializeSizeGuide, mergeSizeGuideIntoHtml } from '../../lib/sizeChart'
import { parseSuitabilityCards, mergeSuitabilityIntoHtml, emptySuitabilityCard, suitabilityCardHasContent } from '../../lib/suitabilityCards'
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import AiHtmlBrief from '../AiHtmlBrief'
import { SortableList, DragHandle } from '../Sortable'
import { showConfirm } from '../../lib/confirm'

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

export function ParagraphBlockEditor({ block, onChange, disabled, productMode }) {
  // Mô tả sản phẩm (productMode) giữ tab "Mã HTML"; bài viết Tin tức chỉ dùng trình soạn trực quan.
  const Editor = productMode ? RichTextEditorWithSource : RichTextEditor
  return (
    <div className="flex-1">
      <Editor
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
  async function removeItem(i) {
    if ((items[i] || '').trim()) {
      const confirmed = await showConfirm(t('products.detail.blocks.removeConfirmMessage'), t('products.detail.blocks.removeConfirmTitle'))
      if (!confirmed) return
    }
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
          <SelectItem value="tiktok">{t('products.detail.blocks.videoTikTok')}</SelectItem>
          <SelectItem value="facebook">{t('products.detail.blocks.videoFacebook')}</SelectItem>
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
      ) : block.provider === 'tiktok' ? (
        <Input
          placeholder={t('products.detail.blocks.tiktokUrlPlaceholder')}
          value={block.url || ''}
          onChange={(e) => onChange({ url: e.target.value })}
          disabled={disabled}
          maxLength={2000}
        />
      ) : block.provider === 'facebook' ? (
        <Input
          placeholder={t('products.detail.blocks.facebookUrlPlaceholder')}
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
            placeholder={t('products.detail.blocks.imageCaptionPlaceholder')}
            value={block.caption || ''}
            onChange={(e) => onChange({ caption: e.target.value })}
            disabled={disabled}
            maxLength={500}
          />
        </div>
      </div>
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
  async function removeItem(i) {
    if ((list[i] || '').trim()) {
      const confirmed = await showConfirm(t('products.detail.blocks.removeConfirmMessage'), t('products.detail.blocks.removeConfirmTitle'))
      if (!confirmed) return
    }
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

/** HTML khối suitability có phải do trình nhập cấu trúc sinh ra không (để mở đúng tab mặc định:
 *  HTML admin tự dán/tùy chỉnh → mở tab HTML, giữ nguyên). */
function isGeneratedSuitabilityHtml(html) {
  const h = (html || '').trim()
  if (!h) return true
  return h.includes('suitability-list')
}

/**
 * Khối "Phù hợp với ai" — `html` là NGUỒN DUY NHẤT được lưu & web render. Tab "Có cấu trúc" chỉ là
 * công cụ nhập: mọi thay đổi thẻ được GHÉP vào `html` hiện có (giữ nguyên CSS/markup, chỉ đổi chữ).
 *  - HTML → Cấu trúc (chuyển tab): parse `html` ra thẻ (bỏ CSS, chỉ lấy chữ).
 *  - Cấu trúc → HTML: `html` đã được merge cập nhật sẵn.
 *  - Cho phép CSS inline khi dán HTML (sanitizeHtml admin đã mở `style`).
 */
export function SuitabilityBlockEditor({ block, onChange, disabled }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState(() =>
    ((block.html || '').trim() && !isGeneratedSuitabilityHtml(block.html)) ? 'html' : 'structured',
  )
  const seedCards = () => {
    const parsed = parseSuitabilityCards(block.html)
    if (parsed.length) return parsed
    if (block.cards && block.cards.length) return block.cards.map((c) => ({ ...emptySuitabilityCard(), ...c }))
    return [emptySuitabilityCard()]
  }
  const [cards, setCards] = useState(seedCards)

  // Ghi thẻ → merge vào html (giữ CSS). html là field được lưu; bỏ ghi `cards` xuống dữ liệu.
  function commit(nextCards) {
    setCards(nextCards)
    onChange({ html: mergeSuitabilityIntoHtml(nextCards, block.html), cards: undefined })
  }
  function changeMode(next) {
    if (next === mode) return
    // Vào tab có cấu trúc: nạp lại thẻ từ html hiện tại (bỏ CSS, chỉ lấy chữ).
    if (next === 'structured') {
      const parsed = parseSuitabilityCards(block.html)
      setCards(parsed.length ? parsed : [emptySuitabilityCard()])
    }
    setMode(next)
  }
  function updateCard(i, patch) { commit(cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c))) }
  function addCard() { commit([...cards, emptySuitabilityCard()]) }
  async function removeCard(i) {
    const card = cards[i]
    const hasContent = suitabilityCardHasContent(card)
    if (hasContent) {
      const confirmed = await showConfirm(t('products.detail.blocks.removeConfirmMessage'), t('products.detail.blocks.removeConfirmTitle'))
      if (!confirmed) return
    }
    const next = cards.filter((_, idx) => idx !== i)
    commit(next.length === 0 ? [emptySuitabilityCard()] : next)
  }

  const html = block.html || ''

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

      <Tabs value={mode} onValueChange={changeMode}>
        <TabsList>
          <TabsTrigger value="structured" disabled={disabled}>
            {t('products.detail.suitability.modeStructured')}
          </TabsTrigger>
          <TabsTrigger value="html" disabled={disabled}>
            {t('products.detail.suitability.modeHtml')}
          </TabsTrigger>
        </TabsList>

        {/* Chế độ NHẬP CÓ CẤU TRÚC */}
        <TabsContent value="structured" className="flex flex-col gap-3">
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
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addCard} disabled={disabled} className="self-start">
            + {t('products.detail.blocks.suitabilityAddCard')}
          </Button>
        </TabsContent>

        {/* Chế độ DÁN MÃ HTML — chỉnh trực tiếp, cho phép CSS inline. */}
        <TabsContent value="html" className="flex flex-col gap-2">
          <Textarea
            className="font-mono text-xs"
            placeholder={t('products.detail.suitability.htmlPlaceholder')}
            value={html}
            onChange={(e) => onChange({ html: e.target.value, cards: undefined })}
            disabled={disabled}
            rows={8}
            maxLength={20000}
          />
          <p className="text-xs text-muted-foreground">{t('products.detail.suitability.htmlHint')}</p>
          <AiHtmlBrief />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('products.detail.suitability.previewLabel')}
            </label>
            {html.trim() ? (
              <div
                className="size-guide-preview rounded-sm border border-border bg-surface p-3 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
              />
            ) : (
              <p className="list-editor-empty">{t('products.detail.suitability.previewEmpty')}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Khối "Bảng size" (V246) — tiêu đề tuỳ chọn + HTML tự do (thường là bảng). */
/** HTML hiện tại có phải do trình nhập có cấu trúc tạo ra không (round-trip ổn định).
 *  Dùng để mở đúng chế độ: HTML admin tự dán (không round-trip được) → mở tab HTML, giữ nguyên. */
function isStructuredHtml(html) {
  const h = html || ''
  if (!h.trim()) return true
  return serializeSizeGuide(parseSizeGuide(h)) === h
}

/**
 * Bảng size — admin chọn LINH HOẠT giữa 2 chế độ nhập, cùng ghi vào một field `block.html`:
 *  1. "Có cấu trúc": trình nhập cột/dòng (số cột linh hoạt) — xem lib/sizeChart.
 *  2. "Dán mã HTML": dán thẳng HTML (vd do AI tạo) + xem trước đã được lọc đúng như web hiển thị.
 * Chế độ KHÔNG lưu vào dữ liệu (giữ nguyên contract {title, html}); mở lại tự nhận diện: HTML tùy
 * chỉnh (không round-trip được) → mở tab HTML để khỏi mất; bảng có cấu trúc → mở tab có cấu trúc.
 * State cục bộ là nguồn sự thật khi đang sửa (reseed khi remount theo block._key ở SortableList).
 */
export function SizeGuideBlockEditor({ block, onChange, disabled }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState(() => (isStructuredHtml(block.html) ? 'structured' : 'html'))
  const [model, setModel] = useState(() => parseSizeGuide(block.html))

  function changeMode(next) {
    if (next === mode) return
    // Vào tab có cấu trúc: nạp lại model từ HTML hiện tại (kể cả HTML vừa dán).
    if (next === 'structured') setModel(parseSizeGuide(block.html))
    setMode(next)
  }

  // Merge model vào html hiện có (giữ CSS, chỉ đổi chữ). html là field được lưu & web render.
  function commit(next) {
    setModel(next)
    onChange({ html: mergeSizeGuideIntoHtml(next, block.html) })
  }
  const setNote = (note) => commit({ ...model, note })
  const renameColumn = (ci, label) =>
    commit({ ...model, columns: model.columns.map((c, idx) => (idx === ci ? { ...c, label } : c)) })
  const addColumn = () =>
    commit({
      ...model,
      columns: [...model.columns, { _key: generateId(), label: '' }],
      rows: model.rows.map((r) => ({ ...r, cells: [...r.cells, ''] })),
    })
  const removeColumn = async (ci) => {
    const hasContent = Boolean(model.columns[ci]?.label?.trim()) || model.rows.some((r) => (r.cells[ci] || '').trim())
    if (hasContent) {
      const confirmed = await showConfirm(t('products.detail.blocks.removeConfirmMessage'), t('products.detail.blocks.removeConfirmTitle'))
      if (!confirmed) return
    }
    commit({
      ...model,
      columns: model.columns.filter((_, idx) => idx !== ci),
      rows: model.rows.map((r) => ({ ...r, cells: r.cells.filter((_, idx) => idx !== ci) })),
    })
  }
  const updateCell = (ri, ci, value) =>
    commit({
      ...model,
      rows: model.rows.map((r, idx) =>
        idx === ri ? { ...r, cells: r.cells.map((c, j) => (j === ci ? value : c)) } : r,
      ),
    })
  const addRow = () =>
    commit({ ...model, rows: [...model.rows, { _key: generateId(), cells: model.columns.map(() => '') }] })
  const removeRow = async (ri) => {
    const hasContent = (model.rows[ri]?.cells || []).some((c) => (c || '').trim())
    if (hasContent) {
      const confirmed = await showConfirm(t('products.detail.blocks.removeConfirmMessage'), t('products.detail.blocks.removeConfirmTitle'))
      if (!confirmed) return
    }
    commit({ ...model, rows: model.rows.filter((_, idx) => idx !== ri) })
  }

  const colCount = model.columns.length
  const gridStyle = { gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }

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

      <Tabs value={mode} onValueChange={changeMode}>
        <TabsList>
          <TabsTrigger value="structured" disabled={disabled}>
            {t('products.detail.sizeGuide.modeStructured')}
          </TabsTrigger>
          <TabsTrigger value="html" disabled={disabled}>
            {t('products.detail.sizeGuide.modeHtml')}
          </TabsTrigger>
        </TabsList>

        {/* Chế độ NHẬP CÓ CẤU TRÚC */}
        <TabsContent value="structured" className="flex flex-col gap-3">
          {/* Tên các cột */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('products.detail.sizeGuide.columnsLabel')}
            </label>
            <div className="flex items-start gap-2">
              <div className="grid flex-1 gap-2" style={gridStyle}>
                {model.columns.map((col, ci) => (
                  <div key={col._key} className="flex items-center gap-1">
                    <Input
                      placeholder={t('products.detail.sizeGuide.columnNamePlaceholder')}
                      aria-label={t('products.detail.sizeGuide.columnLabel', { index: ci + 1 })}
                      value={col.label || ''}
                      onChange={(e) => renameColumn(ci, e.target.value)}
                      disabled={disabled}
                      maxLength={120}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeColumn(ci)} disabled={disabled || colCount <= 1}
                      aria-label={t('products.detail.sizeGuide.removeColumn')}>✕</Button>
                  </div>
                ))}
              </div>
              {/* chừa chỗ thẳng hàng với nút xoá dòng bên dưới */}
              <div className="w-7 shrink-0" aria-hidden="true" />
            </div>
            <Button variant="outline" size="sm" onClick={addColumn} disabled={disabled} className="self-start">
              + {t('products.detail.sizeGuide.addColumn')}
            </Button>
          </div>

          {/* Các dòng size */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('products.detail.sizeGuide.rowsLabel')}
            </label>
            {model.rows.length === 0 && (
              <p className="list-editor-empty">{t('products.detail.sizeGuide.empty')}</p>
            )}
            <SortableList
              items={model.rows}
              getId={(it) => it._key}
              onReorder={(rows) => commit({ ...model, rows })}
              disabled={disabled}
              className="flex flex-col gap-2"
              renderItem={(row, sortable, ri) => (
                <div ref={sortable.setNodeRef} style={sortable.style} className="flex items-center gap-2">
                  <DragHandle handleProps={sortable.handleProps} disabled={disabled} label={t('products.detail.dragToReorder')} />
                  <div className="grid flex-1 gap-2" style={gridStyle}>
                    {row.cells.map((cell, ci) => (
                      <Input
                        key={model.columns[ci]?._key || ci}
                        placeholder={t('products.detail.sizeGuide.cellPlaceholder')}
                        value={cell || ''}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        disabled={disabled}
                        maxLength={120}
                      />
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    onClick={() => removeRow(ri)} disabled={disabled}
                    aria-label={t('products.detail.sizeGuide.removeRow')}>✕</Button>
                </div>
              )}
              footer={
                <Button variant="outline" size="sm" onClick={addRow} disabled={disabled} className="self-start">
                  + {t('products.detail.sizeGuide.addRow')}
                </Button>
              }
            />
          </div>

          {/* Ghi chú */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('products.detail.sizeGuide.noteLabel')}
            </label>
            <Textarea
              placeholder={t('products.detail.sizeGuide.notePlaceholder')}
              value={model.note || ''}
              onChange={(e) => setNote(e.target.value)}
              disabled={disabled}
              rows={2}
              maxLength={2000}
            />
          </div>
        </TabsContent>

        {/* Chế độ DÁN MÃ HTML */}
        <TabsContent value="html" className="flex flex-col gap-2">
          <Textarea
            className="font-mono text-xs"
            placeholder={t('products.detail.sizeGuide.htmlPlaceholder')}
            value={block.html || ''}
            onChange={(e) => onChange({ html: e.target.value })}
            disabled={disabled}
            rows={8}
            maxLength={20000}
          />
          <p className="text-xs text-muted-foreground">{t('products.detail.sizeGuide.htmlHint')}</p>
          <AiHtmlBrief promptKey="products.detail.sizeGuide.aiBriefPrompt" />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('products.detail.sizeGuide.previewLabel')}
            </label>
            {(block.html || '').trim() ? (
              <div
                className="size-guide-preview rounded-sm border border-border bg-surface p-3 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }}
              />
            ) : (
              <p className="list-editor-empty">{t('products.detail.sizeGuide.previewEmpty')}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
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

export function BlockCard({ block, disabled, sortable, onUpdate, onRemove, onDuplicate, onPickImage, onPickVideo, onAltBlur, productMode }) {
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
        {block.type === 'paragraph' && <ParagraphBlockEditor block={block} onChange={onUpdate} disabled={disabled} productMode={productMode} />}
        {block.type === 'list'      && <ListBlockEditor      block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'image'     && <ImageBlockEditor     block={block} onChange={onUpdate} disabled={disabled} onPickImage={onPickImage} onAltBlur={onAltBlur} />}
        {block.type === 'video'     && <VideoBlockEditor     block={block} onChange={onUpdate} disabled={disabled} onPickVideo={onPickVideo} />}
        {block.type === 'callout'   && <CalloutBlockEditor   block={block} onChange={onUpdate} disabled={disabled} />}
        {block.type === 'feature'   && <FeatureBlockEditor   block={block} onChange={onUpdate} disabled={disabled} onPickImage={onPickImage} onAltBlur={onAltBlur} productMode={productMode} />}
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
