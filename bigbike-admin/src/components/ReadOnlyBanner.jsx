import { useTranslation } from 'react-i18next'

export function ReadOnlyBanner({ warning }) {
  const { t } = useTranslation()
  return (
    <div
      className="flex items-start gap-2 rounded-sm border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning"
      role="status"
    >
      <strong>{t('readOnly.prefix')}</strong> {warning || t('readOnly.defaultDesc')}
    </div>
  )
}
