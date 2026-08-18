export function hasHtmlInput(html) {
  return typeof html === 'string' && html.trim().length > 0
}

export function makeHtmlImportResult({ items = [], skippedCount = 0, hasInput, ...extra } = {}) {
  const accepted = Array.isArray(items) ? items : []
  return {
    items: accepted,
    acceptedCount: accepted.length,
    skippedCount: Math.max(0, Number(skippedCount) || 0),
    hasInput: hasInput ?? accepted.length > 0,
    ...extra,
  }
}

export function textOf(element) {
  return (element?.textContent || '').replace(/\s+/g, ' ').trim()
}
