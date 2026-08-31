/**
 * Helpers for editable integer money fields.
 *
 * The form keeps a draft string while the administrator is typing. Grouping
 * separators are accepted on paste, but are not added until the field blurs.
 * This keeps the browser caret independent from locale formatting.
 */

const GROUPING_CHARACTERS = /[.,\s]/
const GROUPED_INTEGER = /^-?\d{1,3}(?:(?:\.\d{3})+|(?:,\d{3})+)$/

function isGroupedInteger(value) {
  return GROUPED_INTEGER.test(String(value ?? '').trim())
}

export function normalizeMoneyDraft(value) {
  const source = String(value ?? '').trim()
  if (!isGroupedInteger(source)) return source
  return source.replace(/[.,]/g, '')
}

export function countDigitsBeforeCaret(value, caret) {
  const safeCaret = Math.max(0, Math.min(Number(caret) || 0, String(value ?? '').length))
  return String(value ?? '')
    .slice(0, safeCaret)
    .replace(/\D/g, '').length
}

export function caretAfterSanitize(value, caret) {
  const source = String(value ?? '')
  const safeCaret = Math.max(0, Math.min(Number(caret) || 0, source.length))
  if (!isGroupedInteger(source)) return safeCaret
  let nextCaret = 0
  for (let index = 0; index < safeCaret; index += 1) {
    if (!GROUPING_CHARACTERS.test(source[index])) nextCaret += 1
  }
  return nextCaret
}

export function resolveMoneyLocale(locale = 'vi-VN') {
  return locale === 'en' || locale === 'en-US' ? 'en-US' : 'vi-VN'
}

export function parseMoneyInput(value) {
  const normalized = normalizeMoneyDraft(value).trim()
  if (!normalized) return null
  if (!/^-?\d+$/.test(normalized)) return Number.NaN
  const parsed = Number(normalized)
  return Number.isInteger(parsed) ? parsed : Number.NaN
}

export function toMoneyNumberOrNull(value, { zeroAsEmpty = false } = {}) {
  const parsed = parseMoneyInput(value)
  if (parsed == null) return null
  if (Number.isNaN(parsed)) return Number.NaN
  if (zeroAsEmpty && parsed === 0) return null
  return parsed
}

export function formatMoneyInput(value, locale = 'vi-VN', { zeroAsEmpty = false } = {}) {
  if (value == null || value === '') return ''
  const parsed = parseMoneyInput(value)
  if (parsed == null) return ''
  if (Number.isNaN(parsed)) return String(value)
  if (zeroAsEmpty && parsed === 0) return ''
  return new Intl.NumberFormat(resolveMoneyLocale(locale), {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(parsed)
}
