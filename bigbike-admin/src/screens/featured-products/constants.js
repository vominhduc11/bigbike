// Hằng số + hàm thuần của màn "Sản phẩm nổi bật" — tách khỏi file screen để giữ đúng
// quy ước của repo (file screen chỉ export component) và để kiểm thử được riêng.

export const FEATURED_GRID_MAX = 12

// Chỉ sản phẩm đang bán mới thật sự xuất hiện ở khối "Sản phẩm nổi bật" trên trang chủ;
// máy chủ cũng chỉ nhận lưu danh sách gồm toàn sản phẩm đang bán.
export function isFeaturedLive(product) {
  return !product?.publishStatus || product.publishStatus === 'PUBLISHED'
}

// Máy chủ báo lỗi theo vị trí trong danh sách và nhắc bằng mã sản phẩm, nội dung tiếng Anh
// ("Product 'prod_x' must be PUBLISHED to appear on the homepage."). Đổi sang câu tiếng Việt
// gọi đúng tên sản phẩm mà chủ shop đang thấy trên màn hình, và tách rõ 2 nguyên nhân:
// sản phẩm đã ngừng bán so với sản phẩm không còn tồn tại.
export function featuredSaveErrorMessage(t, error, items) {
  const details = Array.isArray(error?.details) ? error.details : []
  const nameAt = (field) => {
    const index = Number(String(field ?? '').match(/featuredGrid\.?\[?(\d+)\]?/)?.[1])
    if (!Number.isInteger(index)) return null
    const product = items[index]
    return product?.name || product?.sku || product?.id || null
  }

  const collect = (code) => [
    ...new Set(
      details
        .filter((d) => d?.code === code)
        .map((d) => nameAt(d.field))
        .filter(Boolean),
    ),
  ]

  const notPublished = collect('NOT_PUBLISHED')
  if (notPublished.length > 0) {
    return t('featuredProducts.errNotPublished', {
      names: notPublished.join(', '),
      defaultValue:
        'Chưa lưu được: {{names}} hiện không còn đang bán. Hãy đăng bán lại hoặc bỏ khỏi danh sách nổi bật.',
    })
  }

  const notFound = collect('NOT_FOUND')
  if (notFound.length > 0) {
    return t('featuredProducts.errNotFound', {
      names: notFound.join(', '),
      defaultValue:
        'Chưa lưu được: {{names}} không còn tồn tại. Hãy bỏ khỏi danh sách nổi bật rồi lưu lại.',
    })
  }

  return error?.message || t('common.errorOccurred')
}
