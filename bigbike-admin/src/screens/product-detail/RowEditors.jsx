import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Award, BadgeCheck, Clock, CreditCard, Gift, Headphones, MapPin, Package, RefreshCw, ShieldCheck, Truck, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { generateId } from '@/lib/utils'
import { showConfirm } from '../../lib/confirm'
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import AiHtmlBrief from '../../components/AiHtmlBrief'
import { SortableList, DragHandle } from '../../components/Sortable'
import { parseSpecStatsFromHtml, mergeSpecStatsIntoHtml } from '../../lib/specStatsBlock'
import { parseTrustBadgesFromHtml, mergeTrustBadgesIntoHtml } from '../../lib/trustBadgesBlock'
import { SPEC_STAT_MAX } from './constants'

// Bộ icon dựng sẵn cho khối cam kết (V232) — key khớp COMMITMENT_ICON_MAP bên web.
// labelKey trỏ tới i18n products.detail.commitments.icons.*; mặc định 'shield-check'.
const COMMITMENT_ICON_OPTIONS = [
  { value: 'truck', Icon: Truck, labelKey: 'truck', labelEn: 'Delivery' },
  { value: 'refresh-cw', Icon: RefreshCw, labelKey: 'refreshCw', labelEn: 'Returns' },
  { value: 'shield-check', Icon: ShieldCheck, labelKey: 'shieldCheck', labelEn: 'Warranty' },
  { value: 'badge-check', Icon: BadgeCheck, labelKey: 'badgeCheck', labelEn: 'Genuine' },
  { value: 'credit-card', Icon: CreditCard, labelKey: 'creditCard', labelEn: 'Payment' },
  { value: 'headphones', Icon: Headphones, labelKey: 'headphones', labelEn: 'Support' },
  { value: 'package', Icon: Package, labelKey: 'package', labelEn: 'Packaging' },
  { value: 'gift', Icon: Gift, labelKey: 'gift', labelEn: 'Gift' },
  { value: 'clock', Icon: Clock, labelKey: 'clock', labelEn: 'Fast delivery' },
  { value: 'map-pin', Icon: MapPin, labelKey: 'mapPin', labelEn: 'Store' },
  { value: 'wrench', Icon: Wrench, labelKey: 'wrench', labelEn: 'Installation' },
  { value: 'award', Icon: Award, labelKey: 'award', labelEn: 'Quality' },
]

// Trình soạn khối "cam kết" theo từng sản phẩm (V232): thêm/bớt/đảo dòng tùy ý, mỗi
// dòng tự chọn icon + tiêu đề + mô tả. Tiêu đề/mô tả song ngữ (theo contentLang);
// icon dùng chung (không dịch). Mirror FaqEditor.
export function CommitmentEditor({ items, onChange, disabled, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fTitle = isEn ? 'titleEn' : 'title'
  const fSubtitle = isEn ? 'subtitleEn' : 'subtitle'
  function updateItem(index, field, value) {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), icon: 'shield-check', title: '', subtitle: '', titleEn: '', subtitleEn: '' }])
  }
  async function removeItem(index) {
    const item = items[index]
    const hasContent = Boolean((item?.[fTitle] || item?.[fSubtitle] || '').trim())
    if (hasContent) {
      const confirmed = await showConfirm(t('products.detail.removeRowConfirmMessage'), t('products.detail.removeRowConfirmTitle'))
      if (!confirmed) return
    }
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">
          {isEn ? t('products.detail.commitments.addInViFirst', { defaultValue: 'Thêm dòng ở tab Tiếng Việt trước, rồi quay lại đây để dịch.' }) : t('products.detail.commitments.empty')}
        </p>
      )}
      <SortableList
        items={items}
        getId={(it) => it._key}
        onReorder={(next) => onChange(next)}
        disabled={disabled}
        className="list-editor"
        renderItem={(item, sortable, index) => (
        <div ref={sortable.setNodeRef} style={sortable.style} className="list-editor-row list-editor-row--stack">
          <DragHandle handleProps={sortable.handleProps} disabled={disabled || isEn} label={t('products.detail.dragToReorder')} />
          <div className="flex flex-1 flex-col gap-2">
            {/* Icon dùng chung mọi ngôn ngữ — chỉ cho sửa ở chế độ nội dung tiếng Việt để tránh nhầm. */}
            <Select value={item.icon || 'shield-check'} onValueChange={(v) => updateItem(index, 'icon', v)} disabled={disabled || isEn}>
              <SelectTrigger className="w-full sm:w-56" aria-label={t('products.detail.commitments.iconLabel')}>
                <SelectValue placeholder={t('products.detail.commitments.iconLabel')} />
              </SelectTrigger>
              <SelectContent>
                {COMMITMENT_ICON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <opt.Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {isEn ? opt.labelEn : t(`products.detail.commitments.icons.${opt.labelKey}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('products.detail.commitments.titlePlaceholder')}
              value={item[fTitle] || ''}
              onChange={(e) => updateItem(index, fTitle, e.target.value)}
              disabled={disabled}
              maxLength={200}
            />
            <Input
              placeholder={t('products.detail.commitments.subtitlePlaceholder')}
              value={item[fSubtitle] || ''}
              onChange={(e) => updateItem(index, fSubtitle, e.target.value)}
              disabled={disabled}
              maxLength={300}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeItem(index)}
            disabled={disabled || isEn}
            aria-label={t('products.detail.commitments.removeRow')}
          >
            ✕
          </Button>
        </div>
        )}
        footer={!isEn && (
          <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
            + {t('products.detail.commitments.addRow')}
          </Button>
        )}
      />
    </div>
  )
}

/** HTML dải tin cậy có phải do trình nhập cấu trúc sinh ra không (để mở đúng tab mặc định). */
function isGeneratedTrustBadgesHtml(html) {
  const h = (html || '').trim()
  if (!h) return true
  return h.includes('bb-trust-badges')
}

// "Dải tin cậy" trên tên sản phẩm (V233 + V257). `trustBadgesHtml` (theo ngôn ngữ) là NGUỒN render
// web; tab "Có cấu trúc" chỉ là công cụ nhập (mỗi nhãn = 1 dòng chữ ngắn). Sửa cấu trúc được GHÉP
// vào html (giữ CSS/chấm tròn, chỉ đổi chữ); HTML→Cấu trúc parse bỏ CSS. Key theo contentLang ở screen.
export function TrustBadgesEditor({ disabled, html = '', onHtmlChange }) {
  const { t } = useTranslation()
  const newRow = () => ({ _key: generateId(), content: '' })
  const [mode, setMode] = useState(() =>
    ((html || '').trim() && !isGeneratedTrustBadgesHtml(html)) ? 'html' : 'structured',
  )
  const [rows, setRows] = useState(() => {
    const parsed = parseTrustBadgesFromHtml(html)
    return parsed.length ? parsed : [newRow()]
  })
  // `html` có thể đến muộn (vd sau khi trang tải xong dữ liệu sản phẩm import từ CSV/JSON) — lúc
  // đó `rows` đã lỡ khởi tạo rỗng từ trước và không tự nạp lại. Theo dõi html "bên ngoài" (khác với
  // html do chính commit() vừa ghi lên) để nạp lại rows, tránh tab "Có cấu trúc" đứng hình trống.
  const lastHtmlRef = useRef(html)
  useEffect(() => {
    if (html === lastHtmlRef.current) return
    lastHtmlRef.current = html
    const parsed = parseTrustBadgesFromHtml(html)
    setRows(parsed.length ? parsed : [newRow()])
  }, [html])

  function commit(nextRows) {
    setRows(nextRows)
    const nextHtml = mergeTrustBadgesIntoHtml(nextRows, html)
    lastHtmlRef.current = nextHtml
    onHtmlChange?.(nextHtml)
  }
  function changeMode(next) {
    if (next === mode) return
    if (next === 'structured') {
      const parsed = parseTrustBadgesFromHtml(html)
      setRows(parsed.length ? parsed : [newRow()])
    }
    setMode(next)
  }
  function updateItem(index, value) {
    commit(rows.map((r, i) => (i === index ? { ...r, content: value } : r)))
  }
  function addItem() { commit([...rows, newRow()]) }
  async function removeItem(index) {
    const hasContent = Boolean((rows[index]?.content || '').trim())
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
          renderItem={(item, sortable, index) => (
            <div ref={sortable.setNodeRef} style={sortable.style} className="list-editor-row">
              <DragHandle handleProps={sortable.handleProps} disabled={disabled} label={t('products.detail.dragToReorder')} />
              <div className="flex-1">
                <Input
                  placeholder={t('products.detail.trustBadges.placeholder', { defaultValue: 'vd: Chính hãng' })}
                  value={item.content || ''}
                  onChange={(e) => updateItem(index, e.target.value)}
                  disabled={disabled}
                  maxLength={120}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => removeItem(index)}
                disabled={disabled}
                aria-label={t('products.detail.trustBadges.remove', { defaultValue: 'Xóa nhãn' })}
              >
                ✕
              </Button>
            </div>
          )}
          footer={
            <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
              + {t('products.detail.trustBadges.add', { defaultValue: 'Thêm nhãn' })}
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
          rows={8}
          maxLength={50000}
        />
        <p className="text-xs text-muted-foreground">{t('products.detail.specs.htmlHint')}</p>
        <AiHtmlBrief promptKey="products.detail.trustBadges.aiBriefPrompt" />
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

/** HTML ô số liệu có phải do trình nhập cấu trúc sinh ra không (để mở đúng tab mặc định). */
function isGeneratedSpecStatsHtml(html) {
  const h = (html || '').trim()
  if (!h) return true
  return h.includes('bb-specstats')
}

// "Specs Dashboard" — ô số liệu nổi bật dưới khu vực mua hàng (V235 + V256). `specStatsHtml`
// (theo ngôn ngữ) là NGUỒN render web; tab "Có cấu trúc" chỉ là công cụ nhập (mỗi ô = value + nhãn,
// tối đa 4). Sửa cấu trúc được GHÉP vào html (giữ CSS, chỉ đổi chữ); HTML→Cấu trúc parse bỏ CSS.
// Component được key theo contentLang ở screen → đổi ngôn ngữ = remount + nạp lại theo html.
export function SpecStatEditor({ disabled, html = '', onHtmlChange }) {
  const { t } = useTranslation()
  const newRow = () => ({ _key: generateId(), value: '', label: '' })
  const [mode, setMode] = useState(() =>
    ((html || '').trim() && !isGeneratedSpecStatsHtml(html)) ? 'html' : 'structured',
  )
  const [rows, setRows] = useState(() => {
    const parsed = parseSpecStatsFromHtml(html)
    return parsed.length ? parsed : [newRow()]
  })
  // `html` có thể đến muộn (vd sau khi trang tải xong dữ liệu sản phẩm import từ CSV/JSON) — lúc
  // đó `rows` đã lỡ khởi tạo rỗng từ trước và không tự nạp lại. Theo dõi html "bên ngoài" (khác với
  // html do chính commit() vừa ghi lên) để nạp lại rows, tránh tab "Có cấu trúc" đứng hình trống.
  const lastHtmlRef = useRef(html)
  useEffect(() => {
    if (html === lastHtmlRef.current) return
    lastHtmlRef.current = html
    const parsed = parseSpecStatsFromHtml(html)
    setRows(parsed.length ? parsed : [newRow()])
  }, [html])

  function commit(nextRows) {
    setRows(nextRows)
    const nextHtml = mergeSpecStatsIntoHtml(nextRows, html)
    lastHtmlRef.current = nextHtml
    onHtmlChange?.(nextHtml)
  }
  function changeMode(next) {
    if (next === mode) return
    if (next === 'structured') {
      const parsed = parseSpecStatsFromHtml(html)
      setRows(parsed.length ? parsed : [newRow()])
    }
    setMode(next)
  }
  function updateItem(index, field, value) {
    commit(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }
  function addItem() { commit([...rows, newRow()]) }
  async function removeItem(index) {
    const item = rows[index]
    const hasContent = Boolean((item?.value || item?.label || '').trim())
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
      renderItem={(item, sortable, index) => (
        <div ref={sortable.setNodeRef} style={sortable.style} className="list-editor-row list-editor-row--stack">
          <DragHandle handleProps={sortable.handleProps} disabled={disabled} label={t('products.detail.dragToReorder')} />
          <div className="flex flex-1 flex-col gap-2">
            <Input
              placeholder={t('products.detail.specStats.valuePlaceholder')}
              value={item.value || ''}
              onChange={(e) => updateItem(index, 'value', e.target.value)}
              disabled={disabled}
              maxLength={60}
            />
            <Input
              placeholder={t('products.detail.specStats.labelPlaceholder')}
              value={item.label || ''}
              onChange={(e) => updateItem(index, 'label', e.target.value)}
              disabled={disabled}
              maxLength={80}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeItem(index)}
            disabled={disabled}
            aria-label={t('products.detail.specStats.removeRow')}
          >
            ✕
          </Button>
        </div>
      )}
      footer={
        <Button variant="outline" size="sm" onClick={addItem} disabled={disabled || rows.length >= SPEC_STAT_MAX}>
          + {t('products.detail.specStats.addRow')}
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
        <AiHtmlBrief promptKey="products.detail.specStats.aiBriefPrompt" />
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
