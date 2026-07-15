export async function canReloadHighlightsForLanguageChange({ initialized, isDirty, confirmDiscard }) {
  if (!initialized) return false
  if (!isDirty) return true
  return confirmDiscard()
}
