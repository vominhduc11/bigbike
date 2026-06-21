import { useTranslation } from 'react-i18next'
import { formatDateTime } from '../../lib/formatters'
import { Modal } from '../../components/layout'
import { Button } from '@/components/ui/button'
import { getPublishReadiness } from './constants'

// ── Draft recovery banner ──────────────────────────────────────────────────────

export function DraftRecoveryBanner({ ts, onRestore, onDiscard }) {
  const { t } = useTranslation()
  return (
    <div className="draft-recovery-banner">
      <span>{t('products.detail.draftRecovery.found', { time: formatDateTime(new Date(ts).toISOString()) })}</span>
      <div className="draft-recovery-actions">
        <Button size="sm" onClick={onRestore}>{t('products.detail.draftRecovery.restore')}</Button>
        <Button variant="outline" size="sm" onClick={onDiscard}>{t('products.detail.draftRecovery.discard')}</Button>
      </div>
    </div>
  )
}

// ── Publish quality checklist modal ───────────────────────────────────────────

export function PublishChecklistModal({ form, isCreate, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const items = getPublishReadiness(form, t, isCreate)
  const requiredItems = items.filter((i) => i.required)
  const optionalItems = items.filter((i) => !i.required)
  const blockers = requiredItems.filter((i) => !i.ok)
  const warnings = optionalItems.filter((i) => !i.ok)

  const renderItem = (item) => (
    <li key={item.id} className={`checklist-item ${item.ok ? 'checklist-ok' : item.required ? 'checklist-error' : 'checklist-warn'}`}>
      <span className="checklist-icon" aria-hidden="true">{item.ok ? '✓' : item.required ? '✕' : '⚠'}</span>
      <span>{item.label}</span>
    </li>
  )

  return (
    <Modal
      open
      title={t('products.detail.checklist.title')}
      onClose={onCancel}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>{t('products.detail.checklist.backToEdit')}</Button>
          {blockers.length === 0 && (
            <Button type="button" size="sm" onClick={onConfirm}>{t('products.detail.checklist.publishNow')}</Button>
          )}
        </>
      }
    >
      <ul className="publish-checklist">
        {requiredItems.map(renderItem)}
      </ul>
      {blockers.length > 0 && (
        <p className="modal-note modal-note--error">
          {t('products.detail.checklist.blockerMessage', { count: blockers.length })}
        </p>
      )}

      {optionalItems.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground mt-4 mb-1">
            {t('products.detail.checklist.optionalHeading')}
          </p>
          <ul className="publish-checklist">
            {optionalItems.map(renderItem)}
          </ul>
          {blockers.length === 0 && warnings.length > 0 && (
            <p className="modal-note modal-note--warn">
              {t('products.detail.checklist.warningMessage', { count: warnings.length })}
            </p>
          )}
        </>
      )}
    </Modal>
  )
}
