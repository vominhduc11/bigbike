import { useTranslation } from 'react-i18next'
import { AlertCircle, MapPin } from 'lucide-react'
import { RichTextEditor } from '../../components/RichTextEditor'
import { ImageUrlInput } from '../../components/ImageUrlInput'
import { IMAGE_RECO } from '../../lib/imageRecommendations'
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  displayValue, inputTypeFor, placeholderFor, isTranslatableSetting,
  KEY_LABELS_VI, KEY_HINTS_VI, KEY_RECO,
} from './constants'

export function SettingField({ setting, where, canUpdate, draft, draftEn, error, onChange, onChangeEn }) {
  const { t } = useTranslation()
  const rawValue = displayValue(setting.value)
  const currentValue = draft !== undefined ? draft : rawValue
  const rawValueEn = displayValue(setting.valueEn)
  const currentValueEn = draftEn !== undefined ? draftEn : rawValueEn
  const translatable = isTranslatableSetting(setting)
  const isDirty = (draft !== undefined && draft !== rawValue) || (draftEn !== undefined && draftEn !== rawValueEn)
  const isHtml = setting.valueType === 'HTML'
  const isImage = setting.valueType === 'IMAGE_URL'
  const isLongText = setting.valueType === 'LONG_TEXT'
  const isBoolean = setting.valueType === 'BOOLEAN'
  const isNumber = setting.valueType === 'INTEGER' || setting.valueType === 'DECIMAL' || setting.valueType === 'MONEY'
  const type = isNumber ? 'number' : inputTypeFor(setting.key)
  const placeholder = placeholderFor(setting.key)
  const label = KEY_LABELS_VI[setting.key] || setting.description || setting.key
  // Id ổn định để liên kết nhãn ↔ ô nhập (click nhãn focus ô, screen reader đọc tên nhãn).
  const controlId = `setting-${setting.key}`
  const labelId = `label-${setting.key}`
  const errorId = `err-${setting.key}`

  return (
    <div className="form-field">
      <label id={labelId} htmlFor={controlId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
            value={currentValue}
            onChange={(html) => onChange(setting.key, html)}
            placeholder={t('settings.htmlPlaceholder')}
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
            value={currentValue}
            placeholder={placeholder || (rawValue ? '' : t('settings.empty'))}
            onChange={(e) => onChange(setting.key, e.target.value)}
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
            value={currentValue}
            placeholder={placeholder || (rawValue ? '' : t('settings.empty'))}
            onChange={(e) => onChange(setting.key, e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        )
      ) : isHtml ? (
        <div
          className="text-sm"
          style={{ padding: '8px 12px', background: 'var(--admin-color-surface-muted)', borderRadius: 7 }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawValue) || `<em>${t('settings.htmlEmpty')}</em>` }}
        />
      ) : isImage && rawValue ? (
        <img src={rawValue} alt="" style={{ maxWidth: 240, borderRadius: 8 }} loading="lazy" />
      ) : (
        <div
          className="text-sm"
          style={{ padding: '8px 12px', background: 'var(--admin-color-surface-muted)', borderRadius: 7 }}
        >
          {rawValue || <em className="muted">{t('settings.valueEmpty')}</em>}
        </div>
      )}

      {canUpdate && translatable && (
        <div style={{ marginTop: 8 }}>
          <span className="hint" style={{ display: 'block', marginBottom: 4 }}>{t('settings.englishLabel')}</span>
          {isHtml ? (
            <RichTextEditor
              value={currentValueEn}
              onChange={(html) => onChangeEn(setting.key, html)}
              placeholder={t('settings.englishPlaceholder')}
              enableImagePicker
            />
          ) : isLongText ? (
            <Textarea
              rows={3}
              value={currentValueEn}
              placeholder={t('settings.englishPlaceholder')}
              onChange={(e) => onChangeEn(setting.key, e.target.value)}
            />
          ) : (
            <Input
              value={currentValueEn}
              placeholder={t('settings.englishPlaceholder')}
              onChange={(e) => onChangeEn(setting.key, e.target.value)}
            />
          )}
        </div>
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
