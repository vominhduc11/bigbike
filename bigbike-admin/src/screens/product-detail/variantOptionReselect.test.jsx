// Regression: expanding a legacy variant (option name matches a catalog attribute
// exactly, e.g. "màu sắc") must NOT wipe its stored value/attributeValueId.
//
// Root cause: Radix Select re-emits onValueChange with the current value on mount for
// a row whose selected item is a real catalog item; the attribute-NAME select handler
// treated that no-op reselect as a real change and cleared value + attributeValueId,
// which then reset the derived variant name to the "Biến thể N" default and dirtied the
// form. The fix makes reselect idempotent. These tests encode both select handlers'
// decisions (the exact logic in VariantEditors.jsx).
import { describe, it, expect, vi } from 'vitest'

const CREATE_NEW_ATTRIBUTE_VALUE = '__create_new_attribute__'
const COLOR_ATTRIBUTE_KEYS = new Set([
  'color',
  'colour',
  'mau',
  'mau sac',
  'pa color',
  'pa mau',
  'pa mau sac',
])

function normalizeVariantToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0110/g, 'D')
    .replace(/\u0111/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isColorAttributeName(name) {
  return COLOR_ATTRIBUTE_KEYS.has(normalizeVariantToken(name))
}

function resolveAttr(attributes, optionName) {
  const norm = normalizeVariantToken(optionName)
  return (
    attributes.find(
      (a) => normalizeVariantToken(a.name) === norm || normalizeVariantToken(a.code) === norm,
    ) ?? null
  )
}

function isSameAttributeSelection(attributes, currentName, nextName) {
  const currentAttr = resolveAttr(attributes, currentName)
  const nextAttr = resolveAttr(attributes, nextName)
  if (currentAttr?.id && nextAttr?.id) return currentAttr.id === nextAttr.id
  if (isColorAttributeName(currentName) && isColorAttributeName(nextName)) return true
  return normalizeVariantToken(currentName) === normalizeVariantToken(nextName)
}

// Mirror of the attribute-NAME <Select> onValueChange in VariantOptionRow.
function makeNameChange(opt, onUpdate, setCreateAttrOpen = () => {}, attributes = []) {
  return (val) => {
    if (!val) return
    if (val === CREATE_NEW_ATTRIBUTE_VALUE) {
      setCreateAttrOpen(true)
      return
    }
    if (isSameAttributeSelection(attributes, opt.name, val)) return
    onUpdate({ name: val, value: '', attributeValueId: null })
  }
}

// Mirror of the color-VALUE <Select> onValueChange in VariantOptionRow.
function makeValueChange(opt, attrValues, onUpdate) {
  return (val) => {
    if (!val) return
    const picked = attrValues.find((v) => v.slug === val)
    const nextValue = picked?.label || val
    const nextId = picked?.id || null
    if (nextValue === opt.value && nextId === (opt.attributeValueId || null)) return
    onUpdate({ value: nextValue, attributeValueId: nextId })
  }
}

describe('variant attribute-name reselect (idempotency)', () => {
  it('does NOT clear value/attributeValueId when the same attribute is re-emitted', () => {
    const opt = { name: 'màu sắc', value: 'Đen', attributeValueId: 'wp-attr-value-1767' }
    const onUpdate = vi.fn()
    makeNameChange(opt, onUpdate)('màu sắc') // Radix mount re-emit of the current value
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does NOT clear when the same catalog attribute is re-emitted with different casing', () => {
    const opt = { name: 'màu sắc', value: 'Đen', attributeValueId: 'wp-attr-value-1767' }
    const onUpdate = vi.fn()
    const attributes = [{ id: 'attr-color', name: 'Màu sắc', code: 'color' }]
    makeNameChange(opt, onUpdate, undefined, attributes)('Màu sắc')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does NOT clear when a legacy color alias resolves to the same catalog attribute', () => {
    const opt = { name: 'pa_color', value: 'Đen', attributeValueId: 'wp-attr-value-1767' }
    const onUpdate = vi.fn()
    const attributes = [{ id: 'attr-color', name: 'Màu sắc', code: 'pa_color' }]
    makeNameChange(opt, onUpdate, undefined, attributes)('Màu sắc')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does NOT clear when the controlled select emits an empty mount value', () => {
    const opt = { name: 'màu sắc', value: 'Đen', attributeValueId: 'wp-attr-value-1767' }
    const onUpdate = vi.fn()
    makeNameChange(opt, onUpdate)('')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('DOES clear value/attributeValueId when a different attribute is chosen', () => {
    const opt = { name: 'màu sắc', value: 'Đen', attributeValueId: 'wp-attr-value-1767' }
    const onUpdate = vi.fn()
    makeNameChange(opt, onUpdate)('Size')
    expect(onUpdate).toHaveBeenCalledWith({ name: 'Size', value: '', attributeValueId: null })
  })

  it('opens the create-attribute modal for the sentinel and does not clear', () => {
    const opt = { name: 'màu sắc', value: 'Đen', attributeValueId: 'wp-attr-value-1767' }
    const onUpdate = vi.fn()
    const setCreateAttrOpen = vi.fn()
    makeNameChange(opt, onUpdate, setCreateAttrOpen)(CREATE_NEW_ATTRIBUTE_VALUE)
    expect(setCreateAttrOpen).toHaveBeenCalledWith(true)
    expect(onUpdate).not.toHaveBeenCalled()
  })
})

describe('variant color-value reselect (idempotency)', () => {
  const attrValues = [
    { id: 'wp-attr-value-1767', slug: 'den', label: 'Đen' },
    { id: 'wp-attr-value-6104', slug: 'bac', label: 'BẠC' },
  ]

  it('does NOT emit when the resolved value + id already match', () => {
    const opt = { value: 'Đen', attributeValueId: 'wp-attr-value-1767' }
    const onUpdate = vi.fn()
    makeValueChange(opt, attrValues, onUpdate)('den') // reselect current
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does NOT clear when the controlled select emits an empty mount value', () => {
    const opt = { value: 'Đen', attributeValueId: 'wp-attr-value-1767' }
    const onUpdate = vi.fn()
    makeValueChange(opt, attrValues, onUpdate)('')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('emits label + id when a different color is picked', () => {
    const opt = { value: 'Đen', attributeValueId: 'wp-attr-value-1767' }
    const onUpdate = vi.fn()
    makeValueChange(opt, attrValues, onUpdate)('bac')
    expect(onUpdate).toHaveBeenCalledWith({ value: 'BẠC', attributeValueId: 'wp-attr-value-6104' })
  })
})
