import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * BulkActionBar — thanh hành động hàng loạt khi chọn nhiều dòng.
 *
 * `selectedCount`: số (sẽ tự dịch "{n} đã chọn") hoặc chuỗi đã dịch sẵn (render nguyên).
 * `totalMatching` + `onSelectAllMatching` (+ `allMatchingSelected`): khi đã chọn hết
 * trang hiện tại mà còn nhiều kết quả khớp hơn, hiện nút "Chọn tất cả N kết quả khớp"
 * để áp dụng cho toàn tập (tiêu chí 6.4).
 */
export function BulkActionBar({
  selectedCount, onClear, actions = [], closeLabel,
  totalMatching, onSelectAllMatching, allMatchingSelected,
}) {
  const { t } = useTranslation()
  if (!selectedCount) return null

  const close = closeLabel || t('common.deselect', { defaultValue: 'Bỏ chọn' })
  const countLabel = typeof selectedCount === 'number'
    ? t('common.selectedCount', { count: selectedCount, defaultValue: `${selectedCount} đã chọn` })
    : selectedCount
  const showSelectAll = typeof onSelectAllMatching === 'function'
    && typeof totalMatching === 'number'
    && typeof selectedCount === 'number'
    && totalMatching > selectedCount
    && !allMatchingSelected

  return (
    <div className="bb-bulk-bar" role="region" aria-label={t('common.bulkActions', { defaultValue: 'Hành động hàng loạt' })}>
      <span className="count">{countLabel}</span>
      {showSelectAll && (
        <button type="button" className="bulk-btn" onClick={onSelectAllMatching}>
          {t('common.selectAllMatching', { count: totalMatching, defaultValue: `Chọn tất cả ${totalMatching} kết quả khớp` })}
        </button>
      )}
      {allMatchingSelected && typeof totalMatching === 'number' && (
        <span className="text-xs text-muted-foreground">
          {t('common.allMatchingSelected', { count: totalMatching, defaultValue: `Đã chọn tất cả ${totalMatching} kết quả` })}
        </span>
      )}
      <span className="sep" />
      <div className="bb-row" style={{ gap: 6 }}>
        {actions.map((action, index) => (
          <button
            key={index}
            type="button"
            className={`bulk-btn${action.tone === 'danger' ? ' danger' : ''}`}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          className="bulk-btn"
          onClick={onClear}
          aria-label={close}
          title={close}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
