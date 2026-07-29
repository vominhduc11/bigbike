import { describe, expect, it } from 'vitest'
import { normalizeOrder } from './contracts'

describe('normalizeOrder', () => {
  it('dùng nhãn tiếng Việt khi ảnh chụp tên sản phẩm bị thiếu', () => {
    const order = normalizeOrder({
      id: 'order-1',
      lineItems: [{ id: 'item-1', productName: ' ' }],
    })

    expect(order.items[0].productName).toBe('Sản phẩm không xác định')
  })

  it('không dựng trường updatedAt ngoài hợp đồng chi tiết đơn hàng', () => {
    const order = normalizeOrder({
      id: 'order-1',
      updatedAt: '2026-07-29T00:00:00Z',
    })

    expect(order).not.toHaveProperty('updatedAt')
  })
})
