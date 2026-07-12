import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DangerZoneCard({ onHardDelete, pending }) {
  const { t } = useTranslation()
  return (
    <div className="bb-card" style={{ borderColor: 'var(--admin-color-status-danger-border)' }}>
      <div className="bb-card-body flex items-center justify-between gap-4 flex-wrap">
        <div>
          <strong className="flex items-center gap-2 text-danger">
            <AlertTriangle size={14} aria-hidden="true" />
            {t('categories.detail.dangerZoneTitle')}
          </strong>
          <p className="bb-muted mt-1 text-xs">{t('categories.detail.dangerZoneDesc')}</p>
        </div>
        <Button type="button" variant="danger" onClick={onHardDelete} disabled={pending} aria-busy={pending || undefined}>
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {t('categories.detail.hardDeleteBtn')}
        </Button>
      </div>
    </div>
  )
}
