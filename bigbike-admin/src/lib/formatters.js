/**
 * Canonical VND formatter for admin — "1.250.000 ₫".
 * Accepts integer or float; rounds to nearest integer.
 * Returns em-dash for null/undefined/NaN.
 */
export function formatCurrencyVnd(amount, locale = 'vi-VN') {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  return `${new Intl.NumberFormat(locale).format(Math.round(Number(amount)))} ₫`
}

/** Alias kept for backward compatibility — same output as formatCurrencyVnd. */
export const formatVndShort = formatCurrencyVnd

export function formatDateTime(value) {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }

  return parsed.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Relative time like "2 phút trước", "3 ngày trước". Falls back to absolute
 * date for anything older than ~30 days because relative time gets fuzzy.
 * @param {string|Date} value
 * @param {(key: string, opts?: object) => string} [t]  i18next translator
 */
export function formatRelativeTime(value, t) {
  if (!value) return '—'
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'

  const diffMs = Date.now() - parsed.getTime()
  const sec = Math.round(diffMs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)

  const tt = t || ((k, o) => {
    const map = {
      'time.justNow': 'vừa xong',
      'time.minutesAgo': `${o?.count} phút trước`,
      'time.hoursAgo': `${o?.count} giờ trước`,
      'time.daysAgo': `${o?.count} ngày trước`,
    }
    return map[k] || k
  })

  if (sec < 60) return tt('time.justNow')
  if (min < 60) return tt('time.minutesAgo', { count: min })
  if (hr < 24) return tt('time.hoursAgo', { count: hr })
  if (day < 30) return tt('time.daysAgo', { count: day })
  return formatDateTime(parsed)
}

export function formatText(value, fallback = '—') {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim()
  return normalized || fallback
}

export function stripHtml(value, fallback = '—') {
  if (typeof value !== 'string' || !value.trim()) return fallback
  try {
    const doc = new DOMParser().parseFromString(value, 'text/html')
    const text = (doc.body.textContent ?? '').trim()
    return text || fallback
  } catch {
    return value.replace(/<[^>]*>/g, '').trim() || fallback
  }
}

export function formatBoolean(value, trueLabel = 'Yes', falseLabel = 'No') {
  return value ? trueLabel : falseLabel
}

export function formatDateTimeWithSeconds(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
