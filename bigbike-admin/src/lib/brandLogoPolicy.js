import { readImageFileDimensions } from './useMediaDimensions'

export const BRAND_LOGO_MIN_PIXELS = 400
export const BRAND_LOGO_RATIO_TOLERANCE = 0.01
export const BRAND_LOGO_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp'])

function normalizeMimeType(mimeType) {
  const normalized = (mimeType || '').toLowerCase()
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized
}

export function brandLogoCheckerboardStyle() {
  return {
    backgroundColor: 'var(--admin-color-surface-base)',
    backgroundImage:
      'linear-gradient(45deg, var(--admin-color-surface-muted) 25%, transparent 25%, transparent 75%, var(--admin-color-surface-muted) 75%), linear-gradient(45deg, var(--admin-color-surface-muted) 25%, transparent 25%, transparent 75%, var(--admin-color-surface-muted) 75%)',
    backgroundPosition: '0 0, 10px 10px',
    backgroundSize: '20px 20px',
  }
}

function isSquareEnough(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false
  return Math.abs(width - height) / Math.max(width, height) <= BRAND_LOGO_RATIO_TOLERANCE
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('BRAND_LOGO_UNREADABLE'))
    image.src = url
  })
}

async function detectTransparency(file, width, height) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    const sampleSize = 512
    const scale = Math.min(1, sampleSize / Math.max(width, height))
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const alpha = context.getImageData(0, 0, canvas.width, canvas.height).data
    for (let index = 3; index < alpha.length; index += 4) {
      if (alpha[index] < 255) return true
    }
    return false
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function inspectBrandLogoFile(file) {
  if (!file) throw new Error('BRAND_LOGO_UNREADABLE')
  let dimensions
  try {
    dimensions = await readImageFileDimensions(file)
  } catch {
    throw new Error('BRAND_LOGO_UNREADABLE')
  }
  return {
    file,
    width: dimensions.width,
    height: dimensions.height,
    fileSize: Number(file.size) || 0,
    mimeType: normalizeMimeType(file.type),
    transparent: await detectTransparency(file, dimensions.width, dimensions.height),
  }
}

export function getBrandLogoIssues(details) {
  const issues = []
  if (!details || !Number.isFinite(details.width) || !Number.isFinite(details.height)) {
    return ['UNREADABLE']
  }
  if (!BRAND_LOGO_MIME_TYPES.includes(normalizeMimeType(details.mimeType)))
    issues.push('UNSUPPORTED_TYPE')
  if (details.width < BRAND_LOGO_MIN_PIXELS || details.height < BRAND_LOGO_MIN_PIXELS)
    issues.push('TOO_SMALL')
  if (!isSquareEnough(details.width, details.height)) issues.push('NOT_SQUARE')
  if (details.transparent === false) issues.push('NOT_TRANSPARENT')
  if (details.transparent == null) issues.push('TRANSPARENCY_UNVERIFIED')
  return issues
}

export function getBrandLogoSourceDecision(details) {
  const issues = getBrandLogoIssues(details)
  const blockingBeforeCrop = issues.filter(
    (issue) => issue !== 'NOT_SQUARE' && isBrandLogoBlockingIssue(issue),
  )
  if (blockingBeforeCrop.length) return { needsCrop: false, issues }
  if (issues.includes('NOT_SQUARE')) return { needsCrop: true, issues: [] }
  return { needsCrop: false, issues }
}

export function isBrandLogoBlockingIssue(issue) {
  return !['NOT_TRANSPARENT', 'TRANSPARENCY_UNVERIFIED', 'LEGACY_LOGO'].includes(issue)
}

export function brandLogoIssueTranslationKey(issue) {
  return (
    {
      UNSUPPORTED_TYPE: 'brands.logo.errors.unsupportedType',
      TOO_SMALL: 'brands.logo.errors.tooSmall',
      NOT_SQUARE: 'brands.logo.errors.notSquare',
      NOT_TRANSPARENT: 'brands.logo.errors.notTransparent',
      TRANSPARENCY_UNVERIFIED: 'brands.logo.errors.transparencyUnverified',
      UNREADABLE: 'brands.logo.errors.unreadable',
      MEDIA_UNAVAILABLE: 'brands.logo.errors.mediaUnavailable',
    }[issue] || 'brands.logo.errors.unreadable'
  )
}

export function isBrandLogoReady(details) {
  return getBrandLogoIssues(details).every((issue) => !isBrandLogoBlockingIssue(issue))
}
