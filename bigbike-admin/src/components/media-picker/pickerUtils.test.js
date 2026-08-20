import { describe, expect, it } from 'vitest'
import { getMediaReferenceAdminPath } from './pickerUtils'

describe('getMediaReferenceAdminPath', () => {
  it('dựng route quản trị sản phẩm từ id thay vì dùng route public của API cũ', () => {
    expect(
      getMediaReferenceAdminPath({
        type: 'PRODUCT',
        id: 'prod_123',
        adminPath: '/products/prod_123',
      }),
    ).toBe('/admin/products/prod_123')
  })

  it('sửa route public cũ của ảnh biến thể sang route quản trị sản phẩm', () => {
    expect(
      getMediaReferenceAdminPath({
        type: 'PRODUCT_VARIANT',
        id: 'variant_123',
        adminPath: '/products/prod_456',
      }),
    ).toBe('/admin/products/prod_456')
  })

  it('dựng đúng route quản trị cho nội dung và các module không có trang chi tiết', () => {
    expect(
      getMediaReferenceAdminPath({
        type: 'CONTENT',
        id: 'article_123',
        adminPath: '/content/article_123',
      }),
    ).toBe('/admin/content/ARTICLE/article_123')

    expect(
      getMediaReferenceAdminPath({
        type: 'SLIDER_DESKTOP',
        id: 'slider_123',
        adminPath: '/sliders',
      }),
    ).toBe('/admin/sliders')
  })

  it('không tạo link khi thiếu id hoặc route không thuộc allowlist của admin', () => {
    expect(
      getMediaReferenceAdminPath({
        type: 'PRODUCT',
        adminPath: '/products/prod_deleted',
      }),
    ).toBe('')

    expect(
      getMediaReferenceAdminPath({
        type: 'PRODUCT_VARIANT',
        id: 'variant_deleted',
        adminPath: 'https://bigbike.vn/products/product-cu',
      }),
    ).toBe('')

    expect(
      getMediaReferenceAdminPath({
        type: 'UNKNOWN',
        id: 'unknown_123',
        adminPath: '/admin/not-a-real-module/unknown_123',
      }),
    ).toBe('')
  })
})
