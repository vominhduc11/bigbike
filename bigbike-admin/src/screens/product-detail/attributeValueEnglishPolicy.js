// Immutable backend codes: only these dictionaries have customer-facing English values.
const ATTRIBUTE_CODES_WITH_MANAGED_ENGLISH_VALUES = new Set(['bo', 'co-oc'])

export function hasManagedEnglishValueInput(attribute) {
  return ATTRIBUTE_CODES_WITH_MANAGED_ENGLISH_VALUES.has(attribute?.code)
}
