import { describe, expect, it } from 'vitest'
import { normalizeRedirect } from './contracts'

describe('normalizeRedirect', () => {
  it('giữ trạng thái bật và tắt do máy chủ trả về', () => {
    expect(normalizeRedirect({ id: 'a', enabled: true }).enabled).toBe(true)
    expect(normalizeRedirect({ id: 'b', enabled: false }).enabled).toBe(false)
  })

  it('không tự coi trạng thái thiếu hoặc sai kiểu là đang bật', () => {
    expect(normalizeRedirect({ id: 'a' }).enabled).toBeUndefined()
    expect(normalizeRedirect({ id: 'b', enabled: 'false' }).enabled).toBeUndefined()
  })

  it('chuẩn hóa mã phản hồi về 301 hoặc 410', () => {
    expect(normalizeRedirect({ id: 'a' }).statusCode).toBe(301)
    expect(normalizeRedirect({ id: 'b', statusCode: 410 }).statusCode).toBe(410)
    expect(normalizeRedirect({ id: 'c', statusCode: 302 }).statusCode).toBe(301)
  })
})
