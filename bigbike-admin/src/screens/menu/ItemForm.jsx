import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { FormField } from '../../components/layout'
import { formatParentOption, formatCategoryOption, buildCategoryMenuUrl, isValidCustomUrl } from './constants'

// Radix Select không nhận giá trị rỗng, nên hai giá trị đặc biệt này đại diện cho
// cấp gốc của menu và liên kết tự nhập không gắn với danh mục.
const ROOT_VALUE = '__root__'
const NONE_VALUE = '__none__'

function MenuParentSelect({ value, onChange, options, label, rootLabel }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Select
        value={value || ROOT_VALUE}
        onValueChange={(nextValue) => onChange(nextValue === ROOT_VALUE ? '' : nextValue)}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ROOT_VALUE}>{rootLabel}</SelectItem>
          {options.map((item) => (
            <SelectItem key={item.id} value={item.id}>{formatParentOption(item)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function MenuCategoryPicker({ value, onChange, options, label, noneLabel }) {
  const selectedValue = value.targetType === 'CATEGORY' && value.targetId ? value.targetId : NONE_VALUE

  return (
    <div className="col-span-full flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Select
        value={selectedValue}
        onValueChange={(nextValue) => {
          if (nextValue === NONE_VALUE) {
            onChange({ targetType: 'CUSTOM', targetId: null })
            return
          }
          const category = options.find((item) => item.id === nextValue)
          if (!category) return
          onChange({
            url: buildCategoryMenuUrl(category),
            label: category.name,
            targetType: 'CATEGORY',
            targetId: category.id,
          })
        }}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>
          {options.map((item) => (
            <SelectItem key={item.id} value={item.id}>{formatCategoryOption(item)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ItemForm({ value, onChange, parentOptions, categoryOptions, categoryError, isNew }) {
  const { t } = useTranslation()
  const [labelTouched, setLabelTouched] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    Boolean(value.labelEn || value.parentId || value.openInNewTab || value.status === 'INACTIVE'),
  )
  const categoryLinked = value.targetType === 'CATEGORY'
  const urlInvalid = !categoryLinked && value.url.trim() !== '' && !isValidCustomUrl(value.url)
  const showLabelError = !categoryLinked && labelTouched && value.label.trim() === ''

  return (
    <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
      <FormField
        full
        htmlFor="menu-item-label"
        label={t('menus.itemLabel')}
        required={!categoryLinked}
        helper={categoryLinked ? t('menus.itemLabelCategoryLinkedHint') : undefined}
        error={showLabelError
          ? t('menus.itemLabelRequired', { defaultValue: 'Vui lòng nhập tên hiển thị.' })
          : undefined}
      >
        <Input
          id="menu-item-label"
          value={value.label}
          onChange={(event) => onChange({ label: event.target.value })}
          onBlur={() => setLabelTouched(true)}
          placeholder={t('menus.itemLabelPlaceholder')}
          autoFocus={isNew}
          readOnly={categoryLinked}
          disabled={categoryLinked}
        />
      </FormField>

      {categoryOptions?.length > 0 ? (
        <MenuCategoryPicker
          label={t('menus.itemCategoryPicker')}
          noneLabel={t('menus.itemCategoryPickerNone')}
          value={value}
          options={categoryOptions}
          onChange={onChange}
        />
      ) : categoryError ? (
        <Alert tone="warning" size="sm" className="col-span-full">
          {t('menus.categoryLoadError', { defaultValue: 'Không tải được danh sách danh mục để chọn nhanh — bạn vẫn có thể nhập đường dẫn thủ công bên dưới.' })}
        </Alert>
      ) : null}

      <FormField
        full
        htmlFor="menu-item-url"
        label={t('menus.itemUrlCustom')}
        required={!categoryLinked}
        helper={categoryLinked
          ? t('menus.itemCategoryLinkedHint')
          : !value.url.trim()
            ? t('menus.urlHint')
            : undefined}
        error={urlInvalid
          ? t('menus.urlInvalid', { defaultValue: 'Đường dẫn chưa đúng. Ví dụ: /danh-muc/xe-may hoặc địa chỉ website đầy đủ.' })
          : undefined}
      >
        <Input
          id="menu-item-url"
          value={value.url}
          onChange={(event) => onChange({ url: event.target.value, targetType: 'CUSTOM', targetId: null })}
          placeholder={t('menus.itemUrlPlaceholder')}
          readOnly={categoryLinked}
          disabled={categoryLinked}
        />
      </FormField>

      <div className="col-span-full">
        <CollapsibleSection
          title={t('menus.itemAdvancedTitle', { defaultValue: 'Tùy chọn nâng cao' })}
          hint={t('menus.itemAdvancedHint', { defaultValue: 'Tên tiếng Anh, mục cha, trạng thái, mở tab mới' })}
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((current) => !current)}
          keepMounted
        >
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <FormField
              full
              label={t('menus.itemLabelEn')}
              helper={categoryLinked ? t('menus.itemLabelCategoryLinkedHint') : t('menus.itemLabelEnHint')}
            >
              <Input
                value={value.labelEn}
                onChange={(event) => onChange({ labelEn: event.target.value })}
                placeholder={t('menus.itemLabelEnPlaceholder')}
                readOnly={categoryLinked}
                disabled={categoryLinked}
              />
            </FormField>

            <MenuParentSelect
              label={t('menus.itemParent')}
              rootLabel={t('menus.parentRoot')}
              value={value.parentId}
              options={parentOptions}
              onChange={(parentId) => onChange({ parentId })}
            />

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">{t('menus.itemStatus')}</span>
              <Select value={value.status} onValueChange={(status) => onChange({ status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{t('menus.statusActive')}</SelectItem>
                  <SelectItem value="INACTIVE">{t('menus.statusInactive')}</SelectItem>
                </SelectContent>
              </Select>
              {value.status === 'INACTIVE' ? (
                <small className="text-xs text-warning">{t('menus.statusInactiveHint')}</small>
              ) : null}
            </div>

            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={value.openInNewTab}
                onCheckedChange={(checked) => onChange({ openInNewTab: checked === true })}
              />
              {t('menus.itemOpenInNewTab')}
            </label>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}
