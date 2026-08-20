import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

export const ASSISTANT_ABBREVIATIONS_KEY = 'ai_assistant_abbreviations'
export const ASSISTANT_TEMPLATES_KEY = 'ai_assistant_answer_templates'

function readItems(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeItems(items) {
  return JSON.stringify(items, null, 2)
}

function linesToList(value) {
  return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
}

function listToLines(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function EmptyEditor({ children }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function AbbreviationEditor({ value, onChange, readOnly }) {
  const { t } = useTranslation()
  const items = readItems(value)
  const update = (index, patch) => onChange(writeItems(items.map((item, itemIndex) => (
    itemIndex === index ? { ...item, ...patch } : item
  ))))
  const remove = (index) => onChange(writeItems(items.filter((_, itemIndex) => itemIndex !== index)))
  const add = () => onChange(writeItems([...items, { locale: 'vi', phrase: '', expansion: '', enabled: true }]))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-xs text-muted-foreground">
          {t('settings.assistantConfig.itemCount', { count: items.length, max: 100 })}
        </p>
        {!readOnly ? (
          <Button type="button" variant="secondary" size="sm" onClick={add} disabled={items.length >= 100}>
            <Plus size={15} aria-hidden="true" /> {t('settings.assistantConfig.addAbbreviation')}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? <EmptyEditor>{t('settings.assistantConfig.abbreviationsEmpty')}</EmptyEditor> : null}

      {items.map((item, index) => (
        <div key={index} className="grid gap-3 rounded-md border border-border bg-surface-muted p-3 lg:grid-cols-[8rem_1fr_1fr_auto]">
          <label className="grid gap-1 text-xs font-semibold text-foreground">
            {t('settings.assistantConfig.language')}
            <Select value={item.locale === 'en' ? 'en' : 'vi'} onValueChange={(locale) => update(index, { locale })} disabled={readOnly}>
              <SelectTrigger aria-label={t('settings.assistantConfig.language')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vi">Tiếng Việt</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-foreground">
            {t('settings.assistantConfig.phrase')}
            <Input value={item.phrase || ''} maxLength={80} disabled={readOnly} onChange={(event) => update(index, { phrase: event.target.value })} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-foreground">
            {t('settings.assistantConfig.expansion')}
            <Input value={item.expansion || ''} maxLength={160} disabled={readOnly} onChange={(event) => update(index, { expansion: event.target.value })} />
          </label>
          <div className="flex min-h-11 items-end justify-between gap-3 lg:justify-end">
            <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-foreground">
              {t('settings.assistantConfig.enabled')}
              <Switch checked={item.enabled !== false} disabled={readOnly} onCheckedChange={(enabled) => update(index, { enabled })} />
            </label>
            {!readOnly ? (
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label={t('settings.assistantConfig.removeAbbreviation')}>
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function TemplateEditor({ value, onChange, readOnly }) {
  const { t } = useTranslation()
  const items = readItems(value)
  const update = (index, patch) => onChange(writeItems(items.map((item, itemIndex) => (
    itemIndex === index ? { ...item, ...patch } : item
  ))))
  const remove = (index) => onChange(writeItems(items.filter((_, itemIndex) => itemIndex !== index)))
  const add = () => onChange(writeItems([...items, {
    id: '',
    topic: '',
    enabled: true,
    triggersVi: [],
    triggersEn: [],
    answerVi: '',
    answerEn: '',
  }]))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-xs text-muted-foreground">
          {t('settings.assistantConfig.itemCount', { count: items.length, max: 50 })}
        </p>
        {!readOnly ? (
          <Button type="button" variant="secondary" size="sm" onClick={add} disabled={items.length >= 50}>
            <Plus size={15} aria-hidden="true" /> {t('settings.assistantConfig.addTemplate')}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? <EmptyEditor>{t('settings.assistantConfig.templatesEmpty')}</EmptyEditor> : null}

      {items.map((item, index) => (
        <section key={index} className="rounded-md border border-border bg-surface-muted p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
            <h5 className="m-0 text-sm font-semibold text-foreground">
              {t('settings.assistantConfig.templateNumber', { count: index + 1 })}
            </h5>
            <div className="flex items-center gap-3">
              <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-foreground">
                {t('settings.assistantConfig.enabled')}
                <Switch checked={item.enabled !== false} disabled={readOnly} onCheckedChange={(enabled) => update(index, { enabled })} />
              </label>
              {!readOnly ? (
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label={t('settings.assistantConfig.removeTemplate')}>
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-foreground">
              {t('settings.assistantConfig.templateId')}
              <Input value={item.id || ''} maxLength={80} disabled={readOnly} onChange={(event) => update(index, { id: event.target.value })} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-foreground">
              {t('settings.assistantConfig.topic')}
              <Input value={item.topic || ''} maxLength={120} disabled={readOnly} onChange={(event) => update(index, { topic: event.target.value })} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-foreground">
              {t('settings.assistantConfig.triggersVi')}
              <Textarea className="min-h-24" value={listToLines(item.triggersVi)} disabled={readOnly} placeholder={t('settings.assistantConfig.onePerLine')} onChange={(event) => update(index, { triggersVi: linesToList(event.target.value) })} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-foreground">
              {t('settings.assistantConfig.triggersEn')}
              <Textarea className="min-h-24" value={listToLines(item.triggersEn)} disabled={readOnly} placeholder={t('settings.assistantConfig.onePerLine')} onChange={(event) => update(index, { triggersEn: linesToList(event.target.value) })} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-foreground">
              {t('settings.assistantConfig.answerVi')}
              <Textarea className="min-h-32" value={item.answerVi || ''} maxLength={2000} disabled={readOnly} onChange={(event) => update(index, { answerVi: event.target.value })} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-foreground">
              {t('settings.assistantConfig.answerEn')}
              <Textarea className="min-h-32" value={item.answerEn || ''} maxLength={2000} disabled={readOnly} onChange={(event) => update(index, { answerEn: event.target.value })} />
            </label>
          </div>
        </section>
      ))}
    </div>
  )
}

export function AssistantConfigEditor({ settingKey, value, onChange, readOnly = false }) {
  if (settingKey === ASSISTANT_ABBREVIATIONS_KEY) {
    return <AbbreviationEditor value={value} onChange={onChange} readOnly={readOnly} />
  }
  return <TemplateEditor value={value} onChange={onChange} readOnly={readOnly} />
}
