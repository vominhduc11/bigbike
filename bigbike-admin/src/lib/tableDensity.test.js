import { beforeEach, describe, expect, it } from 'vitest'
import {
  normalizeTableDensity,
  readTableDensity,
  tableDensityStorageKey,
  writeTableDensity,
} from './tableDensity'

describe('table density preference', () => {
  beforeEach(() => window.localStorage.clear())

  it('uses the screen default when no preference exists', () => {
    expect(readTableDensity('products', 'spacious')).toBe('spacious')
    expect(readTableDensity('orders', 'compact')).toBe('compact')
  })

  it('stores a separate valid preference for each screen', () => {
    writeTableDensity('products', 'compact')
    writeTableDensity('orders', 'spacious')

    expect(window.localStorage.getItem(tableDensityStorageKey('products'))).toBe('compact')
    expect(readTableDensity('products', 'spacious')).toBe('compact')
    expect(readTableDensity('orders', 'compact')).toBe('spacious')
  })

  it('falls back safely for stale or invalid values', () => {
    window.localStorage.setItem(tableDensityStorageKey('reviews'), 'extra-tiny')
    expect(readTableDensity('reviews', 'regular')).toBe('regular')
    expect(normalizeTableDensity('unknown', 'unknown')).toBe('regular')
  })
})
