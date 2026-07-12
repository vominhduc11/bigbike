import { describe, it, expect } from 'vitest'
import { toSlug } from './slug'

describe('toSlug', () => {
  it('bỏ dấu tiếng Việt và chuyển đ → d', () => {
    expect(toSlug('Nón bảo hiểm Đỏ')).toBe('non-bao-hiem-do')
  })

  it('kebab-case, gộp khoảng trắng và gạch nối thừa', () => {
    expect(toSlug('  Áo   giáp  ')).toBe('ao-giap')
    expect(toSlug('A -- B')).toBe('a-b')
  })

  it('bỏ ký tự đặc biệt', () => {
    expect(toSlug('Găng tay (size M)!')).toBe('gang-tay-size-m')
  })

  it('an toàn với null/undefined/số', () => {
    expect(toSlug(null)).toBe('')
    expect(toSlug(undefined)).toBe('')
    expect(toSlug(123)).toBe('123')
  })
})
