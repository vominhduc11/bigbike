const VND_FORMATTER = new Intl.NumberFormat('vi-VN')

export function formatCurrencyVnd(amount) {
  if (!Number.isInteger(amount)) {
    return '—'
  }

  return `${VND_FORMATTER.format(amount)} VND`
}

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

export function formatText(value, fallback = '—') {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim()
  return normalized || fallback
}

export function formatBoolean(value, trueLabel = 'Yes', falseLabel = 'No') {
  return value ? trueLabel : falseLabel
}
