/**
 * Split a multi-line shop-hours string into trimmed, non-empty lines for
 * rendering. Falls back to the supplied (already localized) default when the
 * configured value is blank.
 *
 * The localized default must be assembled by the caller — `t()` from next-intl
 * relies on React context and cannot run outside a component.
 */
export function parseShopHours(hours: string, defaultHours: string): string[] {
  return (hours.trim() || defaultHours)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Trim and drop empty values from a set of phone numbers, preserving order. */
export function parsePhones(...phones: string[]): string[] {
  return phones.map((phone) => phone.trim()).filter(Boolean);
}
