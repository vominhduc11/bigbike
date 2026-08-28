export function hasBrandLogoQualityIssue(quality) {
  if (!quality) return false
  return quality.status !== 'VALID' || Boolean(quality.issues?.length)
}
