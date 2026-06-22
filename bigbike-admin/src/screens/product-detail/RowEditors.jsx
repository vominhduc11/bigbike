import { useState } from 'react'
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
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import AiHtmlBrief from '../../components/AiHtmlBrief'
import { SortableList, DragHandle } from '../../components/Sortable'
import { parseSpecStatsFromHtml, mergeSpecStatsIntoHtml } from '../../lib/specStatsBlock'
import { parseTrustBadgesFromHtml, mergeTrustBadgesIntoHtml } from '../../lib/trustBadgesBlock'
import { PURCHASE_LINE_MAX, SPEC_STAT_MAX } from './constants'

// Bộ icon dựng sẵn cho khối cam kết (V232) — key khớp COMMITMENT_ICON_MAP bên web.
// labelKey trỏ tới i18n products.detail.commitments.icons.*; mặc định 'shield-check'.
const COMMITMENT_ICON_OPTIONS = [
  { value: 'truck', Icon: Truck, labelKey: 'truck' },
  { value: 'refresh-cw', Icon: RefreshCw, labelKey: 'refreshCw' },
  { value: 'shield-check', Icon: ShieldCheck, labelKey: 'shieldCheck' },
  { value: 'badge-check', Icon: BadgeCheck, labelKey: 'badgeCheck' },
  { value: 'credit-card', Icon: CreditCard, labelKey: 'creditCard' },
  { value: 'headphones', Icon: Headphones, labelKey: 'headphones' },
  { value: 'package', Icon: Package, labelKey: 'package' },
  { value: 'gift', Icon: Gift, labelKey: 'gift' },
  { value: 'clock', Icon: Clock, labelKey: 'clock' },
  { value: 'map-pin', Icon: MapPin, labelKey: 'mapPin' },
  { value: 'wrench', Icon: Wrench, labelKey: 'wrench' },
  { value: 'award', Icon: Award, labelKey: 'award' },
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
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">{t('products.detail.commitments.empty')}</p>
      )}
      <SortableList
        items={items}
        getId={(it) => it._key}
        onReorder={(next) => onChange(next)}
        disabled={disabled}
        className="list-editor"
        renderItem={(item, sortable, index) => (
        <div ref={sortable.setNodeRef} style={sortable.style} className="list-editor-row list-editor-row--stack">
          <DragHandle handleProps={sortable.handleProps} disabled={disabled} label={t('products.detail.dragToReorder')} />
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
                      {t(`products.detail.commitments.icons.${opt.labelKey}`)}
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
            disabled={disabled}
            aria-label={t('products.detail.commitments.removeRow')}
          >
            ✕
          </Button>
        </div>
        )}
        footer={
          <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
            + {t('products.detail.commitments.addRow')}
          </Button>
        }
      />
    </div>
  )
}

// Loại dòng dựng sẵn cho khối "Mua tại BigBike.vn": chọn 1 loại → tự điền NHÃN + biểu tượng,
// và GỢI Ý giá trị (chỉ điền khi ô giá trị đang trống — không đè chữ admin đã gõ). 3 loại đầu
// (Bảo hành / Giao hàng / Đổi size) khớp mẫu "J. TRUST BLOCK" + dữ liệu backfill V258.
const PURCHASE_LINE_PRESETS = [
  { icon: 'shield-check', Icon: ShieldCheck, label: 'Bảo hành', labelEn: 'Warranty', value: '12 tháng tại BigBike', valueEn: '12 months at BigBike' },
  { icon: 'truck', Icon: Truck, label: 'Giao hàng', labelEn: 'Shipping', value: 'Toàn quốc · COD · Đồng kiểm khi nhận', valueEn: 'Nationwide · COD · check on delivery' },
  { icon: 'refresh-cw', Icon: RefreshCw, label: 'Đổi size', labelEn: 'Size exchange', value: 'Miễn phí đổi trong 30 ngày nếu không vừa', valueEn: 'Free size exchange within 30 days' },
  { icon: 'badge-check', Icon: BadgeCheck, label: 'Chính hãng', labelEn: 'Genuine', value: '', valueEn: '' },
  { icon: 'credit-card', Icon: CreditCard, label: 'Thanh toán', labelEn: 'Payment', value: '', valueEn: '' },
  { icon: 'headphones', Icon: Headphones, label: 'Hỗ trợ / Tư vấn', labelEn: 'Support', value: '', valueEn: '' },
  { icon: 'map-pin', Icon: MapPin, label: 'Cửa hàng', labelEn: 'Store', value: '', valueEn: '' },
  { icon: 'wrench', Icon: Wrench, label: 'Lắp đặt', labelEn: 'Installation', value: '', valueEn: '' },
  { icon: 'gift', Icon: Gift, label: 'Quà tặng', labelEn: 'Gift', value: '', valueEn: '' },
  { icon: 'award', Icon: Award, label: 'Chất lượng', labelEn: 'Quality', value: '', valueEn: '' },
]

// Trình soạn bảng "Mua tại BigBike.vn" dưới khu mua hàng: mỗi dòng = LOẠI DÒNG (dropdown tự điền
// nhãn + gợi ý giá trị) + nhãn (label) + giá trị (value), song ngữ (theo contentLang). Thêm/bớt/đảo
// dòng tùy ý, tối đa 12 dòng. Mirror CommitmentEditor.
export function PurchaseLineEditor({ items, onChange, disabled, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fLabel = isEn ? 'labelEn' : 'label'
  const fValue = isEn ? 'valueEn' : 'value'
  function updateItem(index, field, value) {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  // Chọn loại dòng: đặt biểu tượng + nhãn theo loại; điền gợi ý giá trị CHỈ khi đang trống.
  function applyPreset(index, presetIcon) {
    const preset = PURCHASE_LINE_PRESETS.find((p) => p.icon === presetIcon)
    if (!preset) return
    onChange(items.map((item, i) => {
      if (i !== index) return item
      const next = { ...item, icon: preset.icon, [fLabel]: isEn ? preset.labelEn : preset.label }
      const presetValue = isEn ? preset.valueEn : preset.value
      if (presetValue && !String(item[fValue] || '').trim()) next[fValue] = presetValue
      return next
    }))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), icon: 'shield-check', label: '', value: '', labelEn: '', valueEn: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">{t('products.detail.purchaseLines.empty')}</p>
      )}
      <SortableList
        items={items}
        getId={(it) => it._key}
        onReorder={(next) => onChange(next)}
        disabled={disabled}
        className="list-editor"
        renderItem={(item, sortable, index) => (
        <div ref={sortable.setNodeRef} style={sortable.style} className="list-editor-row list-editor-row--stack">
          <DragHandle handleProps={sortable.handleProps} disabled={disabled} label={t('products.detail.dragToReorder')} />
          <div className="flex flex-1 flex-col gap-2">
            {/* Loại dòng: chọn → tự điền nhãn + biểu tượng, gợi ý giá trị (nếu trống). Biểu tượng dùng chung mọi ngôn ngữ. */}
            <Select value={item.icon || 'shield-check'} onValueChange={(v) => applyPreset(index, v)} disabled={disabled}>
              <SelectTrigger className="w-full sm:w-56" aria-label={t('products.detail.purchaseLines.typeLabel')}>
                <SelectValue placeholder={t('products.detail.purchaseLines.typeLabel')} />
              </SelectTrigger>
              <SelectContent>
                {PURCHASE_LINE_PRESETS.map((opt) => (
                  <SelectItem key={opt.icon} value={opt.icon}>
                    <span className="flex items-center gap-2">
                      <opt.Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {isEn ? opt.labelEn : opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('products.detail.purchaseLines.labelPlaceholder')}
              value={item[fLabel] || ''}
              onChange={(e) => updateItem(index, fLabel, e.target.value)}
              disabled={disabled}
              maxLength={120}
            />
            <Input
              placeholder={t('products.detail.purchaseLines.valuePlaceholder')}
              value={item[fValue] || ''}
              onChange={(e) => updateItem(index, fValue, e.target.value)}
              disabled={disabled}
              maxLength={200}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeItem(index)}
            disabled={disabled}
            aria-label={t('products.detail.purchaseLines.removeRow')}
          >
            ✕
          </Button>
        </div>
        )}
        footer={
          <Button variant="outline" size="sm" onClick={addItem} disabled={disabled || items.length >= PURCHASE_LINE_MAX}>
            + {t('products.detail.purchaseLines.addRow')}
          </Button>
        }
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

  function commit(nextRows) {
    setRows(nextRows)
    onHtmlChange?.(mergeTrustBadgesIntoHtml(nextRows, html))
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
  function removeItem(index) {
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
        <AiHtmlBrief />
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
  const newRow = () => ({ _key: generateId(), value: '', unit: '', label: '' })
  const [mode, setMode] = useState(() =>
    ((html || '').trim() && !isGeneratedSpecStatsHtml(html)) ? 'html' : 'structured',
  )
  const [rows, setRows] = useState(() => {
    const parsed = parseSpecStatsFromHtml(html)
    return parsed.length ? parsed : [newRow()]
  })

  function commit(nextRows) {
    setRows(nextRows)
    onHtmlChange?.(mergeSpecStatsIntoHtml(nextRows, html))
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
  function removeItem(index) {
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
              placeholder={t('products.detail.specStats.unitPlaceholder')}
              value={item.unit || ''}
              onChange={(e) => updateItem(index, 'unit', e.target.value)}
              disabled={disabled}
              maxLength={40}
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
        <AiHtmlBrief />
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
