import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, ImageOff, Lock, MapPin } from 'lucide-react'
import { RichTextEditor } from '../../components/RichTextEditor'
import { ImageUrlInput } from '../../components/ImageUrlInput'
import { IMAGE_RECO } from '../../lib/imageRecommendations'
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import { useContentLang } from '../../lib/contentLang'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  displayValue, inputTypeFor, placeholderFor, isTranslatableSetting,
  settingLabel, settingHint, KEY_RECO,
} from './constants'

export function SettingField({
  setting, where, canUpdate, isSuperAdmin = false, draft, draftEn, error, onChange, onChangeEn, onBlur,
}) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const translatable = isTranslatableSetting(setting)
  const isEnLang = translatable && contentLang === 'en'

  const rawValue = displayValue(setting.value)
  const currentValue = draft !== undefined ? draft : rawValue
  const rawValueEn = displayValue(setting.valueEn)
  const currentValueEn = draftEn !== undefined ? draftEn : rawValueEn
  const isDirty = (draft !== undefined && displayValue(draft) !== rawValue)
    || (draftEn !== undefined && displayValue(draftEn) !== rawValueEn)
  const isHtml = setting.valueType === 'HTML'
  const isImage = setting.valueType === 'IMAGE_URL'
  const isLongText = setting.valueType === 'LONG_TEXT'
  const isBoolean = setting.valueType === 'BOOLEAN'
  const isEnum = setting.valueType === 'ENUM' && Array.isArray(setting.allowedValues) && setting.allowedValues.length > 0
  const isNumber = setting.valueType === 'INTEGER' || setting.valueType === 'DECIMAL' || setting.valueType === 'MONEY'
  const type = isNumber ? 'number' : inputTypeFor(setting.key)
  const placeholder = isEnLang
    ? t('settings.englishPlaceholder')
    : (placeholderFor(setting.key) || (rawValue ? '' : t('settings.empty')))
  const label = settingLabel(setting, t)
  const hint = settingHint(setting, t)

  const controlId = `setting-${setting.key}`
  const labelId = `label-${setting.key}`
  const hintId = `hint-${setting.key}`
  const whereId = `where-${setting.key}`
  const errorId = `err-${setting.key}`
  const describedBy = [
    hint ? hintId : null,
    where ? whereId : null,
    error && !isImage ? errorId : null,
  ].filter(Boolean).join(' ') || undefined

  const activeValue = isEnLang ? currentValueEn : currentValue
  const activeRawValue = isEnLang ? rawValueEn : rawValue
  const LabelElement = isHtml || isImage ? 'span' : 'label'
  function handleActiveChange(value) {
    if (isEnLang) onChangeEn(setting.key, value)
    else onChange(setting.key, value)
  }
  function handleActiveBlur(value) {
    if (!isEnLang) onBlur?.(setting.key, value)
  }

  const readOnlyValue = () => {
    if (isHtml) {
      return (
        <div
          className="min-h-20 rounded-md border border-border bg-surface-muted p-4 text-sm leading-relaxed text-foreground"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(activeRawValue) || `<em>${t('settings.htmlEmpty')}</em>` }}
        />
      )
    }
    if (isImage) {
      if (!rawValue) {
        return (
          <div className="flex min-h-24 items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface-muted p-4 text-sm text-muted-foreground">
            <ImageOff size={18} aria-hidden="true" />
            {t('settings.imageEmpty', { defaultValue: 'Chưa có ảnh được chọn' })}
          </div>
        )
      }
      return (
        <figure className="m-0 rounded-md border border-border bg-surface-muted p-3">
          <img src={rawValue} alt={label} className="max-h-52 max-w-full rounded-sm object-contain" loading="lazy" />
          <figcaption className="mt-2 break-all text-xs text-muted-foreground">{rawValue}</figcaption>
        </figure>
      )
    }
    if (isBoolean) {
      const enabled = activeRawValue === 'true'
      return (
        <div className="rounded-md border border-border bg-surface-muted p-3">
          <span className={enabled ? 'bb-badge bb-badge-success' : 'bb-badge bb-badge-neutral'}>
            {enabled ? <CheckCircle2 size={12} aria-hidden="true" /> : null}
            {enabled ? t('settings.boolOn') : t('settings.boolOff')}
          </span>
        </div>
      )
    }
    return (
      <div className="min-h-11 whitespace-pre-wrap break-words rounded-md border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground">
        {activeRawValue || <em className="text-muted-foreground">{t('settings.valueEmpty')}</em>}
      </div>
    )
  }

  return (
    <div
      className="h-full rounded-md border border-border bg-surface p-4"
      role={isHtml || isImage ? 'group' : undefined}
      aria-labelledby={isHtml || isImage ? labelId : undefined}
      aria-describedby={isHtml || isImage ? describedBy : undefined}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <LabelElement
          id={labelId}
          htmlFor={isHtml || isImage ? undefined : controlId}
          className="text-sm font-semibold leading-5 text-foreground"
        >
          {label}
        </LabelElement>
        {setting.superAdminOnly && !isSuperAdmin ? (
          <span className="bb-badge bb-badge-neutral">
            <Lock size={12} aria-hidden="true" /> {t('settings.superAdminOnly')}
          </span>
        ) : null}
        {isDirty ? (
          <span className="bb-badge bb-badge-warning">
            {t('settings.unsavedDot')}
          </span>
        ) : null}
      </div>

      {hint ? (
        <p id={hintId} className="mb-2 mt-0 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
      {where ? (
        <p id={whereId} className="mb-3 mt-0 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{where}</span>
        </p>
      ) : null}

      {canUpdate ? (
        isHtml ? (
          <RichTextEditor
            value={activeValue}
            onChange={handleActiveChange}
            placeholder={isEnLang ? t('settings.englishPlaceholder') : t('settings.htmlPlaceholder')}
            hasError={Boolean(error)}
            enableImagePicker
          />
        ) : isImage ? (
          <ImageUrlInput
            value={currentValue}
            onChange={(url) => onChange(setting.key, url)}
            error={error}
            previewAlt={label}
            recommend={KEY_RECO[setting.key] || IMAGE_RECO.general}
          />
        ) : isLongText ? (
          <Textarea
            id={controlId}
            className="min-h-28"
            value={activeValue}
            placeholder={placeholder}
            onChange={(event) => handleActiveChange(event.target.value)}
            onBlur={(event) => handleActiveBlur(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
        ) : isBoolean ? (
          <div className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-border bg-surface-muted px-3 py-2">
            <span className="text-sm font-medium text-foreground">
              {currentValue === 'true' ? t('settings.boolOn') : t('settings.boolOff')}
            </span>
            <Switch
              id={controlId}
              checked={currentValue === 'true'}
              onCheckedChange={(checked) => onChange(setting.key, checked ? 'true' : 'false')}
              aria-labelledby={labelId}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
            />
          </div>
        ) : isEnum ? (
          <Select value={activeValue || undefined} onValueChange={handleActiveChange}>
            <SelectTrigger id={controlId} aria-labelledby={labelId} aria-describedby={describedBy}>
              <SelectValue placeholder={t('settings.empty')} />
            </SelectTrigger>
            <SelectContent>
              {setting.allowedValues.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={controlId}
            type={type}
            inputMode={type === 'number' ? 'numeric' : undefined}
            step={setting.valueType === 'DECIMAL' ? 'any' : undefined}
            value={activeValue}
            placeholder={placeholder}
            onChange={(event) => handleActiveChange(event.target.value)}
            onBlur={(event) => handleActiveBlur(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
        )
      ) : readOnlyValue()}

      {error && !isImage ? (
        <p id={errorId} role="alert" className="mb-0 mt-2 flex items-start gap-1.5 text-xs font-semibold text-danger">
          <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
