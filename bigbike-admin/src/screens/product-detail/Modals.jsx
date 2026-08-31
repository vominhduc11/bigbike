import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, X } from 'lucide-react'
import { Modal } from '../../components/layout'
import { Button } from '@/components/ui/button'
import { getPublishReadiness } from './constants'

// ── Publish quality checklist modal ───────────────────────────────────────────

export function PublishChecklistModal({ form, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const items = getPublishReadiness(form, t)
  const requiredItems = items.filter((i) => i.required)
  const optionalItems = items.filter((i) => !i.required)
  const blockers = requiredItems.filter((i) => !i.ok)
  const warnings = optionalItems.filter((i) => !i.ok)

  const renderItem = (item) => {
    // Trạng thái đạt/chưa đạt đang chỉ thể hiện bằng icon + màu; thêm chữ ẩn cho trình đọc màn hình.
    const statusText = item.ok
      ? t('products.detail.checklist.itemDone', { defaultValue: 'Đạt' })
      : item.required
        ? t('products.detail.checklist.itemMissing', { defaultValue: 'Chưa đạt (bắt buộc)' })
        : t('products.detail.checklist.itemOptionalMissing', { defaultValue: 'Nên bổ sung' })
    return (
      <li
        key={item.id}
        className={`checklist-item ${item.ok ? 'checklist-ok' : item.required ? 'checklist-error' : 'checklist-warn'}`}
      >
        <span className="checklist-icon" aria-hidden="true">
          {item.ok ? (
            <Check size={15} />
          ) : item.required ? (
            <X size={15} />
          ) : (
            <AlertTriangle size={15} />
          )}
        </span>
        <span>{item.label}</span>
        <span className="sr-only">{statusText}</span>
      </li>
    )
  }

  return (
    <Modal
      open
      title={t('products.detail.checklist.title')}
      onClose={onCancel}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t('products.detail.checklist.backToEdit')}
          </Button>
          {blockers.length === 0 && (
            <Button type="button" size="sm" onClick={onConfirm}>
              {t('products.detail.checklist.publishNow')}
            </Button>
          )}
        </>
      }
    >
      <ul className="publish-checklist">{requiredItems.map(renderItem)}</ul>
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
          <ul className="publish-checklist">{optionalItems.map(renderItem)}</ul>
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
