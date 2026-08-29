import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

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
              {t(`settings.assistantConfig.days.${day}`, { defaultValue: t('common.unknown') })}
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

export function AssistantConfigEditor({ settingKey, value, onChange, readOnly = false }) {
  if (settingKey !== ASSISTANT_BUSINESS_HOURS_KEY) return null
  return <BusinessHoursEditor value={value} onChange={onChange} readOnly={readOnly} />
}
