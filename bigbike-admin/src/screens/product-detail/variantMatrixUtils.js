import { generateId } from '@/lib/utils'
import { getVariantAttributeGroup, normalizeVariantToken } from '@/lib/schemas'
import { cloneGallery, getVariantColorKey, computeAttrSetWarning } from './constants'

function deriveVariantName(options) {
  return (options || [])
    .filter((option) => (option.value || '').trim())
    .map((option) => option.value.trim())
    .join(' - ')
}

export function skuToken(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[đ]/g, 'd')
    .replace(/[Đ]/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

export function buildVariantMatrixVariants(parsed, { skuPrefix = '' } = {}) {
  if (!parsed.length || parsed.some((attribute) => !attribute.valueIds.length)) return []
  const rank = (name) => ({ color: 0, size: 1 })[getVariantAttributeGroup(name)] ?? 2
  const ordered = [...parsed].sort((left, right) => rank(left.name) - rank(right.name))
  const combos = ordered.reduce(
    (acc, attribute) =>
      acc.flatMap((current) =>
        attribute.valueIds.map((attributeValueId, index) => [
          ...current,
          {
            name: attribute.name,
            value: attribute.values[index],
            attributeValueId,
          },
        ]),
      ),
    [[]],
  )
  const prefix = skuPrefix.trim()

  return combos.map((combo) => {
    const tokens = combo.map((option) => skuToken(option.value)).filter(Boolean)
    return {
      _key: generateId(),
      id: '',
      sku: prefix ? [prefix, ...tokens].join('-').slice(0, 100) : '',
      name: deriveVariantName(combo),
      retailPrice: '',
      salePrice: '',
      isAvailable: true,
      options: combo.map((option) => ({
        name: option.name,
        value: option.value,
        attributeValueId: option.attributeValueId,
      })),
      gallery: [],
      imageUrl: '',
    }
  })
}

export function choiceSignature(options) {
  return (options || [])
    .map(
      (option) =>
        `${getVariantAttributeGroup(option.name) || normalizeVariantToken(option.name)}:${option.attributeValueId || normalizeVariantToken(option.value)}`,
    )
    .sort()
    .join('|')
}

// Only run in response to a selection change. Opening a product never regenerates rows.
export function reconcileChoices(items, parsed, skuPrefix) {
  const generated = buildVariantMatrixVariants(parsed, { skuPrefix })
  const wanted = new Set(generated.map((row) => choiceSignature(row.options)))
  const kept = items.filter((row) => wanted.has(choiceSignature(row.options)))
  const existing = new Set(kept.map((row) => choiceSignature(row.options)))
  const skus = new Set(items.map((row) => row.sku?.trim().toLowerCase()).filter(Boolean))
  const added = generated
    .filter((row) => !existing.has(choiceSignature(row.options)))
    .map((row) => {
      const base = row.sku
      let suffix = 2
      while (row.sku && skus.has(row.sku.toLowerCase())) {
        const tail = `-${suffix++}`
        row.sku = `${base.slice(0, 100 - tail.length)}${tail}`
      }
      if (row.sku) skus.add(row.sku.toLowerCase())
      const color = getVariantColorKey(row)
      const source = color && items.find((item) => getVariantColorKey(item) === color)
      return source
        ? {
            ...row,
            gallery: cloneGallery(source.gallery),
            imageUrl: source.imageUrl,
            imageAlt: source.imageAlt,
            imageWidth: source.imageWidth,
            imageHeight: source.imageHeight,
            imageMimeType: source.imageMimeType,
          }
        : row
    })
  return {
    rows: [...kept, ...added],
    removed: items.filter((row) => !wanted.has(choiceSignature(row.options))),
  }
}

export function getChoiceErrors(items, t) {
  const errors = {}
  const counts = new Map()
  items.forEach((row) => {
    const sku = row.sku?.trim().toLowerCase()
    if (sku) counts.set(sku, (counts.get(sku) || 0) + 1)
  })
  items.forEach((row, index) => {
    const sku = row.sku?.trim().toLowerCase()
    if (!sku) errors[`variants.${index}.sku`] = t('products.detail.errVariantSkuRequired')
    else if (counts.get(sku) > 1)
      errors[`variants.${index}.sku`] = t('products.detail.errVariantSkuDuplicate')
    if (
      !row.options?.length ||
      row.options.some((option) => !option.name?.trim() || !option.value?.trim())
    ) {
      errors[`variants.${index}.options`] = t('products.detail.choices.optionsRequired')
    }
    if (getVariantColorKey(row) && !row.imageUrl?.trim()) {
      errors[`variants.${index}.imageUrl`] = t('products.detail.choices.imageBeforePublish')
    }
  })
  const mismatch = computeAttrSetWarning(items, t)
  mismatch?.offenders.forEach((row) => {
    errors[`variants.${row.index - 1}.options`] = t('products.detail.choices.sameAttributes')
  })
  return errors
}
