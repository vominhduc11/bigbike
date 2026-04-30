import { useTranslation } from 'react-i18next'

export function ReadOnlyBanner({ warning }) {
  const { t } = useTranslation()
  return (
    <div className="read-only-banner" role="status">
      <strong>{t('readOnly.prefix')}</strong>{' '}
      {warning || t('readOnly.defaultDesc')}
    </div>
  )
}
