export const REPORT_PRESETS = [
  { key: 'preset7d', value: '7d', days: 7 },
  { key: 'preset30d', value: '30d', days: 30 },
  { key: 'preset90d', value: '90d', days: 90 },
]

const REPORT_PRESET_VALUES = new Set([...REPORT_PRESETS.map((item) => item.value), 'custom'])

export function normalizeReportPreset(value) {
  return REPORT_PRESET_VALUES.has(value) ? value : '30d'
}

export function isIsoCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

function addCalendarDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function todayInVietnam(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function resolveReportRange(preset, customFrom, customTo, now = new Date()) {
  if (preset === 'custom') return { from: customFrom, to: customTo }
  const selected = REPORT_PRESETS.find((item) => item.value === preset) || REPORT_PRESETS[1]
  const to = todayInVietnam(now)
  return {
    from: addCalendarDays(to, -(selected.days - 1)),
    to,
  }
}

export function shiftRangeBack(from, to) {
  if (!isIsoCalendarDate(from) || !isIsoCalendarDate(to) || from > to) {
    return { from: '', to: '' }
  }
  const spanDays = inclusiveDateSpan(from, to)
  const previousTo = addCalendarDays(from, -1)
  return {
    from: addCalendarDays(previousTo, -(spanDays - 1)),
    to: previousTo,
  }
}

export function inclusiveDateSpan(from, to) {
  if (!isIsoCalendarDate(from) || !isIsoCalendarDate(to) || from > to) return null
  const fromMs = Date.parse(`${from}T00:00:00Z`)
  const toMs = Date.parse(`${to}T00:00:00Z`)
  return Math.round((toMs - fromMs) / 86_400_000) + 1
}
