export function normalizeSizeScaleValue(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/^2XL$/, 'XXL')
    .replace(/^XXXL$/, '3XL')
}

export function parseSizeScaleValues(raw) {
  const values = String(raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const seen = new Set()
  for (const value of values) {
    const key = normalizeSizeScaleValue(value)
    if (seen.has(key)) return { values, duplicate: value }
    seen.add(key)
  }
  return { values, duplicate: '' }
}
