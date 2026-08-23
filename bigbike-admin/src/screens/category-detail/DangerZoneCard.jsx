import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DetailSection } from '@/components/DetailSection'

export function DangerZoneCard({ onHardDelete, pending, isDeleted, onRestore, restorePending }) {
  const { t } = useTranslation()
  return (
    <DetailSection
      className="border-danger-border"
      headingLevel={3}
      title={(
        <span className="flex items-center gap-2 text-danger">
            <AlertTriangle size={14} aria-hidden="true" />
            {t('categories.detail.dangerZoneTitle')}
        </span>
      )}
      description={t('categories.detail.dangerZoneDesc')}
      action={(
        <div className="flex flex-wrap gap-2">
          {isDeleted ? (
            <Button
              type="button"
              variant="outline"
              className="text-success hover:text-success"
              onClick={onRestore}
              disabled={restorePending}
              aria-busy={restorePending || undefined}
            >
              {restorePending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {t('products.restore')}
            </Button>
          ) : null}
          <Button type="button" variant="danger" onClick={onHardDelete} disabled={pending} aria-busy={pending || undefined}>
            {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {t('categories.detail.hardDeleteBtn')}
          </Button>
        </div>
      )}
    />
  )
}
