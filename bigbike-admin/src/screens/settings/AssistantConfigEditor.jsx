import { useEffect, useState } from 'react'
import { AlertTriangle, Eye, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { previewAssistantTemplate } from '../../lib/adminApi'

export const ASSISTANT_ABBREVIATIONS_KEY = 'ai_assistant_abbreviations'
export const ASSISTANT_TEMPLATES_KEY = 'ai_assistant_answer_templates'
export const ASSISTANT_BUSINESS_HOURS_KEY = 'ai_assistant_business_hours'

const BUSINESS_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DEFAULT_BUSINESS_HOURS = {
  timezone: 'Asia/Ho_Chi_Minh',
  days: Object.fromEntries(BUSINESS_DAYS.map((day) => [day, {
    enabled: true,
    open: '09:00',
    close: ['SAT', 'SUN'].includes(day) ? '18:00' : '21:00',
  }])),
}

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
            {item.phrase && item.expansion ? (
              <span className="font-normal text-muted-foreground">
                {t('settings.assistantConfig.abbreviationPreview', { phrase: item.phrase, expansion: item.expansion })}
              </span>
            ) : null}
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

function BusinessHoursEditor({ value, onChange, readOnly }) {
  const { t } = useTranslation()
  let schedule = DEFAULT_BUSINESS_HOURS
  try {
    const parsed = JSON.parse(value || '')
    if (parsed?.days && typeof parsed.days === 'object') {
      schedule = {
        timezone: 'Asia/Ho_Chi_Minh',
        days: Object.fromEntries(BUSINESS_DAYS.map((day) => [day, {
          ...DEFAULT_BUSINESS_HOURS.days[day],
          ...(parsed.days[day] || {}),
        }])),
      }
    }
  } catch {
    schedule = DEFAULT_BUSINESS_HOURS
  }
  const updateDay = (day, patch) => onChange(JSON.stringify({
    ...schedule,
    timezone: 'Asia/Ho_Chi_Minh',
    days: { ...schedule.days, [day]: { ...schedule.days[day], ...patch } },
  }))

  return (
    <div className="grid gap-3">
      <p className="m-0 text-xs text-muted-foreground">{t('settings.assistantConfig.businessTimezone')}</p>
      {BUSINESS_DAYS.map((day) => {
        const window = schedule.days[day]
        return (
          <div key={day} className="grid gap-3 rounded-md border border-border bg-surface-muted p-3 sm:grid-cols-[8rem_1fr_1fr] sm:items-end">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground">
              <Switch checked={window.enabled !== false} disabled={readOnly} onCheckedChange={(enabled) => updateDay(day, { enabled })} />
              {t(`settings.assistantConfig.days.${day}`)}
            </label>
            <label className="grid gap-1 text-xs font-semibold text-foreground">
              {t('settings.assistantConfig.opensAt')}
              <Input type="time" value={window.open || '09:00'} disabled={readOnly || window.enabled === false} onChange={(event) => updateDay(day, { open: event.target.value })} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-foreground">
              {t('settings.assistantConfig.closesAt')}
              <Input type="time" value={window.close || '18:00'} disabled={readOnly || window.enabled === false} onChange={(event) => updateDay(day, { close: event.target.value })} />
            </label>
          </div>
        )
      })}
    </div>
  )
}

function TemplateEditor({ value, onChange, readOnly }) {
  const { t } = useTranslation()
  const items = readItems(value)
  const [previewInputs, setPreviewInputs] = useState({})
  const [previewResults, setPreviewResults] = useState({})
  const [previewing, setPreviewing] = useState(null)
  const update = (index, patch) => onChange(writeItems(items.map((item, itemIndex) => (
    itemIndex === index ? { ...item, ...patch } : item
  ))))
  const remove = (index) => onChange(writeItems(items.filter((_, itemIndex) => itemIndex !== index)))
  const add = () => onChange(writeItems([...items, {
    id: '',
    topic: '',
    enabled: false,
    triggersVi: [],
    triggersEn: [],
    answerVi: '',
    answerEn: '',
  }]))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.sessionStorage.getItem('bigbike:assistant-template-prefill')
    if (!raw) return
    window.sessionStorage.removeItem('bigbike:assistant-template-prefill')
    try {
      const prefill = JSON.parse(raw)
      const feedbackSuffix = String(prefill?.feedbackId || '').replaceAll('-', '').slice(0, 12)
      onChange(writeItems([...readItems(value), {
        id: feedbackSuffix ? `feedback-${feedbackSuffix}` : '',
        topic: String(prefill?.topic || ''),
        enabled: false,
        triggersVi: Array.isArray(prefill?.triggersVi) ? prefill.triggersVi : [],
        triggersEn: Array.isArray(prefill?.triggersEn) ? prefill.triggersEn : [],
        answerVi: '',
        answerEn: '',
      }]))
    } catch {
      // A malformed browser draft is ignored; the saved server value remains untouched.
    }
  }, [onChange, value])

  function updatePreviewInput(index, patch) {
    setPreviewInputs((current) => ({
      ...current,
      [index]: { locale: 'vi', question: '', ...(current[index] || {}), ...patch },
    }))
  }

  async function preview(index, item) {
    const input = { locale: 'vi', question: '', ...(previewInputs[index] || {}) }
    const sampleQuestion = input.question.trim()
      || (input.locale === 'en' ? item.triggersEn?.[0] : item.triggersVi?.[0])
      || t('settings.assistantConfig.previewQuestionFallback')
    setPreviewing(index)
    setPreviewResults((current) => ({ ...current, [index]: null }))
    try {
      const result = await previewAssistantTemplate({
        topic: item.topic || '',
        triggersVi: Array.isArray(item.triggersVi) ? item.triggersVi : [],
        triggersEn: Array.isArray(item.triggersEn) ? item.triggersEn : [],
        answerVi: item.answerVi || '',
        answerEn: item.answerEn || '',
        locale: input.locale,
        sampleQuestion,
      })
      setPreviewResults((current) => ({ ...current, [index]: { data: result } }))
    } catch (error) {
      setPreviewResults((current) => ({ ...current, [index]: { error: error?.message || t('settings.assistantConfig.previewError') } }))
    } finally {
      setPreviewing(null)
    }
  }

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

          <div className="mt-4 grid gap-3 border-t border-border pt-4">
            <div className="grid gap-3 md:grid-cols-[9rem_1fr_auto] md:items-end">
              <label className="grid gap-1 text-xs font-semibold text-foreground">
                {t('settings.assistantConfig.previewLanguage')}
                <Select
                  value={previewInputs[index]?.locale || 'vi'}
                  onValueChange={(locale) => updatePreviewInput(index, { locale })}
                >
                  <SelectTrigger aria-label={t('settings.assistantConfig.previewLanguage')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vi">Tiếng Việt</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-foreground">
                {t('settings.assistantConfig.previewQuestion')}
                <Input
                  value={previewInputs[index]?.question || ''}
                  maxLength={1000}
                  placeholder={t('settings.assistantConfig.previewQuestionPlaceholder')}
                  onChange={(event) => updatePreviewInput(index, { question: event.target.value })}
                />
              </label>
              <Button type="button" variant="secondary" disabled={previewing === index} onClick={() => preview(index, item)}>
                <Eye size={15} aria-hidden="true" />
                {previewing === index ? t('settings.assistantConfig.previewing') : t('settings.assistantConfig.preview')}
              </Button>
            </div>
            {previewResults[index]?.error ? (
              <p role="alert" className="m-0 text-sm font-semibold text-danger">{previewResults[index].error}</p>
            ) : null}
            {previewResults[index]?.data ? (
              <div className={`rounded-md border p-3 ${previewResults[index].data.canEnable ? 'border-success bg-success-bg' : 'border-warning bg-warning-bg'}`}>
                {previewResults[index].data.canEnable ? (
                  <>
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-success">{t('settings.assistantConfig.customerWillSee')}</p>
                    <p className="mb-0 mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {previewResults[index].data.matched
                        ? previewResults[index].data.answer
                        : t('settings.assistantConfig.notMatched')}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="m-0 flex items-center gap-2 text-sm font-semibold text-warning">
                      <AlertTriangle size={16} aria-hidden="true" /> {t('settings.assistantConfig.cannotEnable')}
                    </p>
                    <ul className="mb-0 mt-2 grid gap-1 pl-5 text-sm text-foreground">
                      {previewResults[index].data.violations.map((code) => (
                        <li key={code}>{t(`settings.assistantConfig.violations.${code}`, { defaultValue: code })}</li>
                      ))}
                    </ul>
                    <p className="mb-0 mt-2 text-xs text-muted-foreground">{t('settings.assistantConfig.contentUnchanged')}</p>
                  </>
                )}
              </div>
            ) : null}
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
  if (settingKey === ASSISTANT_BUSINESS_HOURS_KEY) {
    return <BusinessHoursEditor value={value} onChange={onChange} readOnly={readOnly} />
  }
  return <TemplateEditor value={value} onChange={onChange} readOnly={readOnly} />
}
