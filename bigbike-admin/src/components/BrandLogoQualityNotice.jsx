import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { HelpTooltip } from './HelpTooltip'

const ISSUE_KEYS = {
  MISSING_LOGO: 'brands.logo.quality.issueMissing',
  LEGACY_LOGO: 'brands.logo.quality.issueLegacy',
  NOT_SQUARE: 'brands.logo.quality.issueNotSquare',
  TOO_SMALL: 'brands.logo.quality.issueTooSmall',
  TOO_LARGE: 'brands.logo.quality.issueTooLarge',
  UNSUPPORTED_TYPE: 'brands.logo.quality.issueUnsupportedType',
  NOT_TRANSPARENT: 'brands.logo.quality.issueNotTransparent',
  TRANSPARENCY_UNVERIFIED: 'brands.logo.quality.issueTransparencyUnverified',
  MEDIA_UNAVAILABLE: 'brands.logo.quality.issueMediaUnavailable',
}

function ratioLabel(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return '?'
  return ratio.toFixed(2).replace(/\.00$/, '')
}

export function BrandLogoQualityNotice({ quality, compact = false }) {
  const { t } = useTranslation()
  if (!quality) return null

  const rawIssues = quality.status === 'LEGACY'
    ? (quality.issues || []).filter((issue) => issue !== 'LEGACY_LOGO')
    : (quality.issues || [])
  const issues = rawIssues.map((issue) => t(ISSUE_KEYS[issue] || 'brands.logo.quality.issueMediaUnavailable', {
    ratio: ratioLabel(quality.ratio),
    defaultValue: issue,
  }))
  const issueText = issues.join(', ') || t(
    quality.status === 'LEGACY'
      ? 'brands.logo.quality.issueLegacy'
      : 'brands.logo.quality.issueMediaUnavailable',
  )
  const message = quality.status === 'MISSING'
    ? t('brands.logo.quality.missing')
    : quality.status === 'LEGACY'
      ? t('brands.logo.quality.legacy', { issues: issueText })
      : quality.status === 'VALID'
        ? t('brands.logo.quality.warning', { issues: issueText })
      : t('brands.logo.quality.invalid', { issues: issueText })

  if (quality.status === 'VALID' && !issues.length) return null

  if (compact) {
    const label = t('brands.logo.quality.rowWarning')
    return (
      <span className="mt-1 flex items-center gap-1">
        <Badge variant="warning" className="whitespace-nowrap px-1 py-1 font-medium">
          {label}
        </Badge>
        <HelpTooltip content={message} label={`${label}: ${message}`} />
      </span>
    )
  }

  return (
    <Alert tone="warning" size="sm" className="mt-3">
      <p>{message}</p>
      <p className="mt-1 font-normal text-warning">
        {t('brands.logo.quality.replaceHint')}
      </p>
    </Alert>
  )
}
