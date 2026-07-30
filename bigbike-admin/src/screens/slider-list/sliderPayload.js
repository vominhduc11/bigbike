// Pure helpers for SliderListScreen — extracted so the payload shape and the
// "link ngoài HOẶC sản phẩm" rule are unit-testable without mounting the screen.
import { validateSafePublicLink } from '../../lib/urlPolicies'

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
    externalLink: form.externalLink.trim() || undefined,
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

// Bắt buộc có link ngoài HOẶC sản phẩm (chọn 1 trong 2); link ngoài phải an toàn.
// Trả message lỗi, chuỗi rỗng = hợp lệ. Dùng chung cho on-blur lẫn on-submit.
export function validateSliderLinkGroup(values, t) {
  if (!values.externalLink.trim() && !values.productId.trim()) {
    return t('sliders.formRequired')
  }
  if (values.externalLink.trim() && !validateSafePublicLink(values.externalLink).valid) {
    return t('sliders.formExternalLinkInvalid')
  }
  return ''
}
