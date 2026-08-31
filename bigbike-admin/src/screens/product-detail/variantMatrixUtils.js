import { generateId } from '@/lib/utils'

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

export function buildVariantMatrixVariants(parsed, { skuPrefix = '', sharedPrice = '' } = {}) {
  const combos = parsed.reduce(
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
      retailPrice: sharedPrice,
      salePrice: '',
      isAvailable: true,
      options: combo.map((option) => ({
        name: option.name,
        value: option.value,
        attributeValueId: option.attributeValueId,
      })),
      gallery: [],
    }
  })
}
