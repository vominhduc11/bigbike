import { describe, expect, it } from 'vitest'
import { computeReturnedItemsValue, suggestedRefundAmount, validateRefundAmount } from './returns'

describe('computeReturnedItemsValue', () => {
  it('sums unitPrice * quantity over items', () => {
    expect(computeReturnedItemsValue([
      { unitPrice: 100000, quantity: 2 },
      { unitPrice: 50000, quantity: 1 },
    ])).toBe(250000)
  })

  it('excludes items marked FAIL on inspection', () => {
    expect(computeReturnedItemsValue([
      { unitPrice: 100000, quantity: 1, inspectionResult: 'PASS' },
      { unitPrice: 999000, quantity: 1, inspectionResult: 'FAIL' },
    ])).toBe(100000)
  })

  it('is robust to missing/empty input', () => {
    expect(computeReturnedItemsValue(undefined)).toBe(0)
    expect(computeReturnedItemsValue([])).toBe(0)
    expect(computeReturnedItemsValue([{ quantity: 2 }])).toBe(0)
  })
})

describe('suggestedRefundAmount', () => {
  it('full coverage → whole refundable amount', () => {
    expect(suggestedRefundAmount({ isPartialCoverage: false, returnedItemsValue: 100000, refundableAmount: 500000 }))
      .toBe(500000)
  })

  it('partial coverage → returned items value, capped at refundable', () => {
    expect(suggestedRefundAmount({ isPartialCoverage: true, returnedItemsValue: 120000, refundableAmount: 500000 }))
      .toBe(120000)
    expect(suggestedRefundAmount({ isPartialCoverage: true, returnedItemsValue: 800000, refundableAmount: 500000 }))
      .toBe(500000)
  })

  it('partial coverage with no computed value falls back to refundable', () => {
    expect(suggestedRefundAmount({ isPartialCoverage: true, returnedItemsValue: 0, refundableAmount: 500000 }))
      .toBe(500000)
  })
})

describe('validateRefundAmount', () => {
  it('requires a positive amount', () => {
    expect(validateRefundAmount({ amount: 0, refundableAmount: 500000, isPartialCoverage: false })).toBe('required')
    expect(validateRefundAmount({ amount: -1, refundableAmount: 500000, isPartialCoverage: true })).toBe('required')
  })

  it('partial coverage: accepts ≤ refundable, rejects over', () => {
    expect(validateRefundAmount({ amount: 200000, refundableAmount: 500000, isPartialCoverage: true })).toBeNull()
    expect(validateRefundAmount({ amount: 500000, refundableAmount: 500000, isPartialCoverage: true })).toBeNull()
    expect(validateRefundAmount({ amount: 500001, refundableAmount: 500000, isPartialCoverage: true })).toBe('exceeds')
  })

  it('full coverage: requires an exact match', () => {
    expect(validateRefundAmount({ amount: 500000, refundableAmount: 500000, isPartialCoverage: false })).toBeNull()
    expect(validateRefundAmount({ amount: 400000, refundableAmount: 500000, isPartialCoverage: false })).toBe('mustMatch')
    expect(validateRefundAmount({ amount: 500001, refundableAmount: 500000, isPartialCoverage: false })).toBe('mustMatch')
  })
})
