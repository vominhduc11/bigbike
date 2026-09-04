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

/**
 * Tập cỡ hợp lệ của một bảng cỡ, đã chuẩn hoá đúng cách backend so khớp
 * (SizeScaleCatalog.normalizeValue). Nhận cả `valueKey` lẫn `label` vì dữ liệu
 * thật có bảng ghi khoá, có bảng ghi nhãn.
 */
export function sizeScaleValueKeys(scale) {
  const keys = new Set()
  for (const value of scale?.values ?? []) {
    if (value?.active === false) continue
    for (const raw of [value?.valueKey, value?.label, value?.labelEn]) {
      const normalized = normalizeSizeScaleValue(raw)
      if (normalized) keys.add(normalized)
    }
  }
  return keys
}

/**
 * Lọc danh sách giá trị thuộc tính cỡ xuống đúng các cỡ của bảng cỡ đang chọn.
 *
 * Hai điều kiện an toàn bắt buộc:
 * - Dùng đúng `normalizeSizeScaleValue` mà chốt chặn phía máy chủ dùng, nên danh
 *   sách hiện ra luôn bằng đúng tập giá trị lưu được — không nới lỏng, không siết thêm.
 * - Giá trị đang lưu (`currentValue`) luôn được giữ lại dù nằm ngoài bảng cỡ, để
 *   sản phẩm cũ mở lên không bị mất lựa chọn. Dòng đó được đánh dấu `outOfScale`
 *   để giao diện cảnh báo thay vì im lặng.
 *
 * Không có bảng cỡ → trả nguyên danh sách; việc khoá ô chọn do giao diện quyết định.
 */
export function filterValuesBySizeScale(attrValues, scale, currentValue) {
  const values = Array.isArray(attrValues) ? attrValues : []
  if (!scale) return values.map((value) => ({ ...value, outOfScale: false }))

  const allowed = sizeScaleValueKeys(scale)
  const current = normalizeSizeScaleValue(currentValue)
  const matchesCurrent = (value) =>
    Boolean(current) &&
    [value?.slug, value?.label, value?.labelEn].some(
      (raw) => normalizeSizeScaleValue(raw) === current,
    )

  const filtered = []
  for (const value of values) {
    const inScale = [value?.label, value?.labelEn, value?.slug].some((raw) => {
      const normalized = normalizeSizeScaleValue(raw)
      return Boolean(normalized) && allowed.has(normalized)
    })
    if (inScale) filtered.push({ ...value, outOfScale: false })
    else if (matchesCurrent(value)) filtered.push({ ...value, outOfScale: true })
  }
  return filtered
}
