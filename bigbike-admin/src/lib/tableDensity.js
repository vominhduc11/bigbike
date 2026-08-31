export const TABLE_DENSITIES = ['compact', 'regular', 'spacious']

export function normalizeTableDensity(value, fallback = 'regular') {
  if (TABLE_DENSITIES.includes(value)) return value
  return TABLE_DENSITIES.includes(fallback) ? fallback : 'regular'
}

export function tableDensityStorageKey(screenKey) {
  return `bigbike-admin:table-density:${screenKey}`
}

export function readTableDensity(screenKey, fallback = 'regular') {
  if (!screenKey || typeof window === 'undefined') return normalizeTableDensity(fallback)
  try {
    return normalizeTableDensity(
      window.localStorage.getItem(tableDensityStorageKey(screenKey)),
      fallback,
    )
  } catch {
    return normalizeTableDensity(fallback)
  }
}

export function writeTableDensity(screenKey, density) {
  const normalized = normalizeTableDensity(density)
  if (!screenKey || typeof window === 'undefined') return normalized
  try {
    window.localStorage.setItem(tableDensityStorageKey(screenKey), normalized)
  } catch {
    // Trình duyệt có thể chặn localStorage; lựa chọn vẫn có hiệu lực trong phiên hiện tại.
  }
  return normalized
}
