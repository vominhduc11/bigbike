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
  setting, where, canUpdate, draft, draftEn, error, onChange, onChangeEn, onBlur, enLocked, onLockField,
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
  // Gõ tay lúc đang xem EN → khoá field đó, lần lưu sau không tự dịch đè (V309).
  const activeValue = isEnLang ? currentValueEn : currentValue
  const activeRawValue = isEnLang ? rawValueEn : rawValue
  function handleActiveChange(value) {
    if (isEnLang) {
      onChangeEn(setting.key, value)
      onLockField?.(setting.key)
    } else {
      onChange(setting.key, value)
    }
  }
  function handleActiveBlur(value) {
    if (!isEnLang) onBlur?.(setting.key, value)
  }

  return (
    <div className="form-field">
      <label id={labelId} htmlFor={controlId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--admin-space-2)' }}>
        {label}
        {isDirty && (
          <span
            aria-label={t('settings.unsavedDot')}
            className="settings-dirty-dot"
          />
        )}
      </label>
      {where && (
        <span
          className="bb-muted"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--admin-space-1)',
            fontSize: 'var(--admin-text-xs)', marginTop: 'calc(-1 * var(--admin-space-1) / 2)',
            marginBottom: 'var(--admin-space-2)',
          }}
        >
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
          className="text-sm"
          style={{ padding: '8px 12px', background: 'var(--admin-color-surface-muted)', borderRadius: 7 }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(activeRawValue) || `<em>${t('settings.htmlEmpty')}</em>` }}
        />
      ) : isImage && rawValue ? (
        <img src={rawValue} alt="" style={{ maxWidth: 240, borderRadius: 8 }} loading="lazy" />
      ) : (
        <div
          className="text-sm"
          style={{ padding: '8px 12px', background: 'var(--admin-color-surface-muted)', borderRadius: 7 }}
        >
          {activeRawValue || <em className="muted">{t('settings.valueEmpty')}</em>}
        </div>
      )}

      {isEnLang && enLocked && (
        <span className="hint" style={{ display: 'block', marginTop: 4 }}>{t('settings.englishLocked')}</span>
      )}

      {error && (
        <span
          id={errorId}
          role="alert"
          className="bb-muted"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--admin-space-1)',
            color: 'var(--bb-danger)',
          }}
        >
          <AlertCircle size={13} aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  )
}
