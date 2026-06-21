import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { formatParentOption, isValidCustomUrl } from './constants'

// Radix Select cấm value rỗng, nên dùng sentinel cho lựa chọn "cấp gốc".
const ROOT_VALUE = '__root__'

function MenuParentSelect({ value, onChange, options, label, rootLabel }) {
  return (
    <label className="form-field">
      {label}
      <Select
        value={value || ROOT_VALUE}
        onValueChange={(v) => onChange(v === ROOT_VALUE ? '' : v)}
      ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value={ROOT_VALUE}>{rootLabel}</SelectItem>
        {options.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {formatParentOption(item)}
          </SelectItem>
        ))}
      </SelectContent></Select>
    </label>
  )
}

export function ItemForm({ value, onChange, parentOptions, isNew }) {
  const { t } = useTranslation()
  const urlInvalid = value.url.trim() !== '' && !isValidCustomUrl(value.url)
  return (
    <div className="form-grid">
      {/* Label — required (Vietnamese) */}
      <label className="form-field form-field-wide">
        {t('menus.itemLabel')}
        <Input
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={t('menus.itemLabelPlaceholder')}
          autoFocus={isNew}
         />
      </label>

      {/* Label — English (optional) */}
      <label className="form-field form-field-wide">
        {t('menus.itemLabelEn')}
        <Input
          value={value.labelEn}
          onChange={(e) => onChange({ labelEn: e.target.value })}
          placeholder={t('menus.itemLabelEnPlaceholder')}
         />
        <small className="menu-form-hint">{t('menus.itemLabelEnHint')}</small>
      </label>

      {/* URL */}
      <label className="form-field form-field-wide" htmlFor="menu-item-url">
        {t('menus.itemUrlCustom')}
        <Input
          id="menu-item-url"
          value={value.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="/danh-muc-san-pham/... hoặc https://..."
          aria-invalid={urlInvalid || undefined}
          aria-describedby="menu-item-url-hint"
         />
        {value.url.trim() ? (
          urlInvalid && (
            <small id="menu-item-url-hint" className="menu-form-hint menu-form-hint--danger">
              {t('menus.urlInvalid', { defaultValue: 'Lỗi: URL không hợp lệ. Ví dụ: /danh-muc-san-pham/xe-may hoặc https://example.com' })}
            </small>
          )
        ) : (
          <small id="menu-item-url-hint" className="menu-form-hint">{t('menus.urlHint')}</small>
        )}
      </label>

      {/* Parent — bao gồm lựa chọn "cấp gốc" để có thể đưa mục con lên cấp đầu */}
      <MenuParentSelect
        label={t('menus.itemParent')}
        rootLabel={t('menus.parentRoot')}
        value={value.parentId}
        options={parentOptions}
        onChange={(v) => onChange({ parentId: v })}
      />

      {/* Status */}
      <label className="form-field">
        {t('menus.itemStatus')}
        <Select
          value={value.status}
          onValueChange={(val) => onChange({ status: val })}
        ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="ACTIVE">{t('menus.statusActive')}</SelectItem>
          <SelectItem value="INACTIVE">{t('menus.statusInactive')}</SelectItem>
        </SelectContent></Select>
        {value.status === 'INACTIVE' && (
          <small className="menu-form-hint menu-form-hint--warn">{t('menus.statusInactiveHint')}</small>
        )}
      </label>

      {/* Open in new tab */}
      <label className="form-checkbox">
        <Checkbox
          checked={value.openInNewTab}
          onCheckedChange={(checked) => onChange({ openInNewTab: checked === true })}
         />
        {t('menus.itemOpenInNewTab')}
      </label>
    </div>
  )
}
