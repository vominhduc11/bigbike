import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { formatParentOption, formatCategoryOption, buildCategoryMenuUrl, isValidCustomUrl } from './constants'

// Radix Select cấm value rỗng, nên dùng sentinel cho lựa chọn "cấp gốc".
const ROOT_VALUE = '__root__'
// Sentinel cho "không liên kết danh mục nào" trong MenuCategoryPicker.
const NONE_VALUE = '__none__'

// Dấu * đỏ cạnh nhãn trường bắt buộc (glyph + màu, không chỉ màu).
function RequiredMark() {
  return <span className="text-danger ml-1" aria-hidden="true">*</span>
}

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

// Chọn 1 danh mục có sẵn để tự điền Tên + URL, thay vì admin phải gõ tay/nhớ
// slug. Chọn xong sẽ liên kết mục menu này với danh mục (targetType=CATEGORY)
// — nhờ vậy tên & đường link luôn tự cập nhật theo danh mục (kể cả sau khi
// đổi tên/slug danh mục), 2 ô Tên/URL bên dưới khoá lại không sửa tay được.
// Chọn "— Không liên kết danh mục —" để huỷ liên kết và tự nhập tay.
function MenuCategoryPicker({ value, onChange, options, label, noneLabel }) {
  const selectedValue = value.targetType === 'CATEGORY' && value.targetId ? value.targetId : NONE_VALUE
  return (
    <label className="form-field form-field-wide">
      {label}
      <Select
        value={selectedValue}
        onValueChange={(v) => {
          if (v === NONE_VALUE) {
            onChange({ targetType: 'CUSTOM', targetId: null })
            return
          }
          const category = options.find((c) => c.id === v)
          if (!category) return
          onChange({
            url: buildCategoryMenuUrl(category),
            label: category.name,
            targetType: 'CATEGORY',
            targetId: category.id,
          })
        }}
      ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>
        {options.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {formatCategoryOption(item)}
          </SelectItem>
        ))}
      </SelectContent></Select>
    </label>
  )
}

export function ItemForm({ value, onChange, parentOptions, categoryOptions, categoryError, isNew }) {
  const { t } = useTranslation()
  const [labelTouched, setLabelTouched] = useState(false)
  // F10 chống ngợp: giữ 2 trường cốt lõi (Tên + URL) luôn hiện, gom 4 trường tùy chọn vào
  // nhóm thu gọn — nhưng tự mở sẵn khi đang sửa mục đã có giá trị tùy chọn để không giấu dữ liệu.
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    Boolean(value.labelEn || value.parentId || value.openInNewTab || value.status === 'INACTIVE'),
  )
  const categoryLinked = value.targetType === 'CATEGORY'
  const urlInvalid = !categoryLinked && value.url.trim() !== '' && !isValidCustomUrl(value.url)
  const labelMissing = value.label.trim() === ''
  const showLabelError = !categoryLinked && labelTouched && labelMissing
  return (
    <div className="form-grid">
      {/* Chú thích trường bắt buộc */}
      <p className="form-field-wide menu-form-hint">
        <span className="text-danger" aria-hidden="true">*</span>{' '}
        {t('menus.requiredLegend', { defaultValue: 'Bắt buộc' })}
      </p>

      {/* Label — required (Vietnamese); khoá lại khi đã liên kết danh mục (tự lấy theo tên danh mục) */}
      <label className="form-field form-field-wide" htmlFor="menu-item-label">
        <span>
          {t('menus.itemLabel')}
          {!categoryLinked && <RequiredMark />}
        </span>
        <Input
          id="menu-item-label"
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          onBlur={() => setLabelTouched(true)}
          placeholder={t('menus.itemLabelPlaceholder')}
          autoFocus={isNew}
          readOnly={categoryLinked}
          disabled={categoryLinked}
          aria-required={!categoryLinked}
          aria-invalid={showLabelError || undefined}
          aria-describedby={showLabelError ? 'menu-item-label-error' : categoryLinked ? 'menu-item-label-hint' : undefined}
         />
        {categoryLinked ? (
          <small id="menu-item-label-hint" className="menu-form-hint">{t('menus.itemLabelCategoryLinkedHint')}</small>
        ) : showLabelError && (
          <small id="menu-item-label-error" className="menu-form-hint menu-form-hint--danger" role="alert">
            {t('menus.itemLabelRequired', { defaultValue: 'Vui lòng nhập tên hiển thị.' })}
          </small>
        )}
      </label>

      {/* Chọn danh mục có sẵn — tự điền URL, khỏi phải nhớ slug */}
      {categoryOptions?.length > 0 ? (
        <MenuCategoryPicker
          label={t('menus.itemCategoryPicker')}
          noneLabel={t('menus.itemCategoryPickerNone')}
          value={value}
          options={categoryOptions}
          onChange={onChange}
        />
      ) : categoryError ? (
        <p className="form-field-wide menu-form-hint menu-form-hint--warn" role="status">
          {t('menus.categoryLoadError', { defaultValue: 'Không tải được danh sách danh mục để chọn nhanh — bạn vẫn có thể nhập đường dẫn thủ công bên dưới.' })}
        </p>
      ) : null}

      {/* URL — khoá lại khi đã liên kết danh mục (tự lấy theo đường dẫn danh mục) */}
      <label className="form-field form-field-wide" htmlFor="menu-item-url">
        <span>
          {t('menus.itemUrlCustom')}
          {!categoryLinked && <RequiredMark />}
        </span>
        <Input
          id="menu-item-url"
          value={value.url}
          onChange={(e) => onChange({ url: e.target.value, targetType: 'CUSTOM', targetId: null })}
          placeholder="/danh-muc/... hoặc https://..."
          readOnly={categoryLinked}
          disabled={categoryLinked}
          aria-required={!categoryLinked}
          aria-invalid={urlInvalid || undefined}
          aria-describedby="menu-item-url-hint"
         />
        {categoryLinked ? (
          <small id="menu-item-url-hint" className="menu-form-hint">{t('menus.itemCategoryLinkedHint')}</small>
        ) : value.url.trim() ? (
          urlInvalid && (
            <small id="menu-item-url-hint" className="menu-form-hint menu-form-hint--danger">
              {t('menus.urlInvalid', { defaultValue: 'Đường dẫn chưa đúng. Ví dụ: /danh-muc/xe-may hoặc địa chỉ website đầy đủ.' })}
            </small>
          )
        ) : (
          <small id="menu-item-url-hint" className="menu-form-hint">{t('menus.urlHint')}</small>
        )}
      </label>

      {/* Tùy chọn nâng cao — thu gọn sẵn: tên tiếng Anh, mục cha, trạng thái, mở tab mới */}
      <div className="form-field-wide">
        <CollapsibleSection
          title={t('menus.itemAdvancedTitle', { defaultValue: 'Tùy chọn nâng cao' })}
          hint={t('menus.itemAdvancedHint', { defaultValue: 'Tên tiếng Anh, mục cha, trạng thái, mở tab mới' })}
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((v) => !v)}
          keepMounted
        >
          <div className="form-grid">
            {/* Label — English (optional); khoá lại khi đã liên kết danh mục (tự lấy theo tên tiếng Anh của danh mục) */}
            <label className="form-field form-field-wide">
              {t('menus.itemLabelEn')}
              <Input
                value={value.labelEn}
                onChange={(e) => onChange({ labelEn: e.target.value })}
                placeholder={t('menus.itemLabelEnPlaceholder')}
                readOnly={categoryLinked}
                disabled={categoryLinked}
               />
              <small className="menu-form-hint">
                {categoryLinked ? t('menus.itemLabelCategoryLinkedHint') : t('menus.itemLabelEnHint')}
              </small>
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
        </CollapsibleSection>
      </div>
    </div>
  )
}
