import { useTranslation } from 'react-i18next'
import { HelpTooltip } from '@/components/HelpTooltip'

const SCREEN_GROUPS = ['sales', 'products', 'content', 'reports', 'system']

function normalizedText(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim().toLocaleLowerCase()
    : ''
}

export function ScreenHeader({ group, eyebrow, title, description, help, helpLabel, actions, badge }) {
  const { t } = useTranslation()
  const groupLabel = group && SCREEN_GROUPS.includes(group) ? t(`nav.group.${group}`) : eyebrow
  const showGroupLabel = groupLabel && normalizedText(groupLabel) !== normalizedText(title)

  return (
    <header className="bb-screen-header">
      <div className="bb-screen-title">
        {showGroupLabel ? <p className="bb-screen-eyebrow">{groupLabel}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1>{title}</h1>
          {badge}
          {help ? <HelpTooltip content={help} label={helpLabel} /> : null}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="bb-screen-actions">{actions}</div> : null}
    </header>
  )
}
