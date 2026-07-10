import { useTranslation } from 'react-i18next'
import { AlertCircle, MapPin } from 'lucide-react'
import { RichTextEditor } from '../../components/RichTextEditor'
import { ImageUrlInput } from '../../components/ImageUrlInput'
import { IMAGE_RECO } from '../../lib/imageRecommendations'
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import { useContentLang } from '../../lib/contentLang'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  displayValue, inputTypeFor, placeholderFor, isTranslatableSetting,
  KEY_LABELS_VI, KEY_HINTS_VI, KEY_RECO,
} from './constants'

export function SettingField({
  setting, where, canUpdate, draft, draftEn, error, onChange, onChangeEn, onBlur,
}) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const translatable = isTranslatableSetting(setting)
  // Non-translatable settings (image/number/phone/boolean/bank…) always show their one Vietnamese
  // value regardless of the admin topbar VI/EN toggle — same as Product's price/SKU fields, which
  // have no translation at all.
  const isEnLang = translatable && contentLang === 'en'

  const rawValue = displayValue(setting.value)
  const currentValue = draft !== undefined ? draft : rawValue
  const rawValueEn = displayValue(setting.valueEn)
  const currentValueEn = draftEn !== undefined ? draftEn : rawValueEn
  const isDirty = (draft !== undefined && draft !== rawValue) || (draftEn !== undefined && draftEn !== rawValueEn)
  const isHtml = setting.valueType === 'HTML'
  const isImage = setting.valueType === 'IMAGE_URL'
  const isLongText = setting.valueType === 'LONG_TEXT'
  const isBoolean = setting.valueType === 'BOOLEAN'
  const isNumber = setting.valueType === 'INTEGER' || setting.valueType === 'DECIMAL' || setting.valueType === 'MONEY'
  const type = isNumber ? 'number' : inputTypeFor(setting.key)
  const placeholder = isEnLang
    ? t('settings.englishPlaceholder')
    : (placeholderFor(setting.key) || (rawValue ? '' : t('settings.empty')))
  const label = KEY_LABELS_VI[setting.key] || setting.description || setting.key
  // Id ổn định để liên kết nhãn ↔ ô nhập (click nhãn focus ô, screen reader đọc tên nhãn).
  const controlId = `setting-${setting.key}`
  const labelId = `label-${setting.key}`
  const errorId = `err-${setting.key}`

  // Ô DUY NHẤT đổi theo nút VI/EN ở header admin (mirror ProductDetailScreen langValue/langChange).
  const activeValue = isEnLang ? currentValueEn : currentValue
  const activeRawValue = isEnLang ? rawValueEn : rawValue
  function handleActiveChange(value) {
    if (isEnLang) {
      onChangeEn(setting.key, value)
    } else {
      onChange(setting.key, value)
    }
  }
  function handleActiveBlur(value) {
    if (!isEnLang) onBlur?.(setting.key, value)
  }

  return (
    <div className="form-field">
      <label id={labelId} htmlFor={controlId} className="flex items-center gap-2">
        {label}
        {isDirty && (
          <span
            aria-label={t('settings.unsavedDot')}
            className="settings-dirty-dot"
          />
        )}
      </label>
      {where && (
        <span className="bb-muted inline-flex items-center gap-1 text-xs -mt-0.5 mb-2">
          <MapPin size={12} aria-hidden="true" /> {where}
        </span>
      )}

      {canUpdate ? (
        isHtml ? (
          <RichTextEditor
            value={activeValue}
            onChange={(html) => handleActiveChange(html)}
            placeholder={isEnLang ? t('settings.englishPlaceholder') : t('settings.htmlPlaceholder')}
            hasError={Boolean(error)}
            enableImagePicker
          />
        ) : isImage ? (
          <>
            <ImageUrlInput
              value={currentValue}
              onChange={(url) => onChange(setting.key, url)}
              error={error}
              recommend={KEY_RECO[setting.key] || IMAGE_RECO.general}
            />
            {KEY_HINTS_VI[setting.key] && (
              <span className="hint">{KEY_HINTS_VI[setting.key]}</span>
            )}
          </>
        ) : isLongText ? (
          <Textarea
            id={controlId}
            className={error ? 'border-danger' : undefined}
            rows={3}
            value={activeValue}
            placeholder={placeholder}
            onChange={(e) => handleActiveChange(e.target.value)}
            onBlur={(e) => handleActiveBlur(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        ) : isBoolean ? (
          <Select value={currentValue || 'false'} onValueChange={(v) => onChange(setting.key, v)}>
            <SelectTrigger id={controlId} aria-labelledby={`${labelId} ${controlId}`} className={error ? 'border-danger' : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t('settings.boolOn')}</SelectItem>
              <SelectItem value="false">{t('settings.boolOff')}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={controlId}
            className={error ? 'border-danger' : undefined}
            type={type}
            inputMode={type === 'number' ? 'numeric' : undefined}
            step={setting.valueType === 'DECIMAL' ? 'any' : undefined}
            value={activeValue}
            placeholder={placeholder}
            onChange={(e) => handleActiveChange(e.target.value)}
            onBlur={(e) => handleActiveBlur(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        )
      ) : isHtml ? (
        <div
          className="text-sm px-3 py-2 bg-surface-muted rounded-sm"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(activeRawValue) || `<em>${t('settings.htmlEmpty')}</em>` }}
        />
      ) : isImage && rawValue ? (
        <img src={rawValue} alt="" className="max-w-60 rounded-sm" loading="lazy" />
      ) : (
        <div
          className="text-sm px-3 py-2 bg-surface-muted rounded-sm"
        >
          {activeRawValue || <em className="muted">{t('settings.valueEmpty')}</em>}
        </div>
      )}

      {error && (
        <span
          id={errorId}
          role="alert"
          className="inline-flex items-center gap-1 text-danger"
        >
          <AlertCircle size={13} aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  )
}
