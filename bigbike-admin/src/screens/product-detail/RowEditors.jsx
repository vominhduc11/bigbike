import { useTranslation } from 'react-i18next'
import {
  Award, BadgeCheck, Clock, CreditCard, Gift, Headphones, MapPin, Package, RefreshCw, ShieldCheck, Truck, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { generateId } from '@/lib/utils'
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
        <p className="list-editor-empty">{t('products.detail.commitments.empty')}</p>
      )}
      {items.map((item, index) => (
        <div key={item._key} className="list-editor-row list-editor-row--stack">
          <div className="list-editor-reorder">
            <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
            <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
          </div>
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
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.commitments.addRow')}
      </Button>
    </div>
  )
}

// Trình soạn bảng "Mua tại BigBike.vn" dưới khu mua hàng: mỗi dòng = icon + nhãn (label)
// + giá trị (value), song ngữ (theo contentLang); icon dùng chung. Thêm/bớt/đảo dòng tùy ý,
// tối đa 12 dòng. Mirror CommitmentEditor — dùng lại COMMITMENT_ICON_OPTIONS.
export function PurchaseLineEditor({ items, onChange, disabled, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fLabel = isEn ? 'labelEn' : 'label'
  const fValue = isEn ? 'valueEn' : 'value'
  function updateItem(index, field, value) {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), icon: 'shield-check', label: '', value: '', labelEn: '', valueEn: '' }])
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
        <p className="list-editor-empty">{t('products.detail.purchaseLines.empty')}</p>
      )}
      {items.map((item, index) => (
        <div key={item._key} className="list-editor-row list-editor-row--stack">
          <div className="list-editor-reorder">
            <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
            <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
          </div>
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
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled || items.length >= PURCHASE_LINE_MAX}>
        + {t('products.detail.purchaseLines.addRow')}
      </Button>
    </div>
  )
}

// "Specs Dashboard" — ô số liệu nổi bật dưới khu vực mua hàng (V235): mỗi ô gồm một số
// liệu lớn (value) + nhãn (label), song ngữ; tối đa 4 ô. Là "đòn chốt" bán hàng, KHÔNG
// phải lặp lại thông số kỹ thuật.
export function SpecStatEditor({ items, onChange, disabled, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fValue = isEn ? 'valueEn' : 'value'
  const fLabel = isEn ? 'labelEn' : 'label'
  function updateItem(index, field, value) {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), value: '', label: '', valueEn: '', labelEn: '' }])
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
        <p className="list-editor-empty">{t('products.detail.specStats.empty')}</p>
      )}
      {items.map((item, index) => (
        <div key={item._key} className="list-editor-row list-editor-row--stack">
          <div className="list-editor-reorder">
            <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
            <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Input
              placeholder={t('products.detail.specStats.valuePlaceholder')}
              value={item[fValue] || ''}
              onChange={(e) => updateItem(index, fValue, e.target.value)}
              disabled={disabled}
              maxLength={60}
            />
            <Input
              placeholder={t('products.detail.specStats.labelPlaceholder')}
              value={item[fLabel] || ''}
              onChange={(e) => updateItem(index, fLabel, e.target.value)}
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
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled || items.length >= SPEC_STAT_MAX}>
        + {t('products.detail.specStats.addRow')}
      </Button>
    </div>
  )
}
