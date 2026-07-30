// Pure helpers for SliderListScreen — extracted so the payload shape and the
// required linked-product rule are unit-testable without mounting the screen.

// Slider vị trí Trang chủ là hero duy nhất còn quản lý qua màn này (owner 2026-07-15).
export const HOME_LOCATION = 'home'

// Dựng payload gửi lên khi tạo/sửa slider. Ảnh desktop chỉ gửi khi có URL (backend
// whitelist qua SafeMediaAssetUrlPolicy). Ảnh mobile được quản lý rõ trong form:
// có URL thì gửi URL + alt, không có URL thì gửi null để backend xóa thật.
export function buildSliderPayload(form) {
  const payload = {
    location: form.location,
    sortOrder: Number(form.sortOrder),
    isActive: form.isActive,
    productId: form.productId.trim() || undefined,
  }
  if (form.desktopImageUrl.trim()) {
    payload.desktopImage = { url: form.desktopImageUrl.trim() }
  }
  payload.mobileImage = form.mobileImageUrl.trim()
    ? {
        url: form.mobileImageUrl.trim(),
        alt: form.mobileImageAlt.trim() || null,
      }
    : null
  return payload
}

// Bắt buộc chọn sản phẩm liên kết. Trả message lỗi, chuỗi rỗng = hợp lệ.
export function validateSliderProduct(values, t) {
  return values.productId.trim() ? '' : t('sliders.formProductRequired')
}
