import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

export function DangerZoneCard({ onHardDelete, pending }) {
  const { t } = useTranslation()
  return (
    <div className="bb-card" style={{ borderColor: 'var(--admin-color-status-danger-border)' }}>
      <div className="bb-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <strong className="flex items-center gap-2 text-danger">
            <AlertTriangle size={14} aria-hidden="true" />
            {t('categories.detail.dangerZoneTitle')}
          </strong>
          <p className="bb-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>{t('categories.detail.dangerZoneDesc')}</p>
        </div>
        <button type="button" className="bb-btn bb-btn-danger" onClick={onHardDelete} disabled={pending}>
          {t('categories.detail.hardDeleteBtn')}
        </button>
      </div>
    </div>
  )
}
