import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  totalMatching, onSelectAllMatching, allMatchingSelected, className,
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
    <div className={cn('flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 shadow-sm', className)} role="region" aria-label={t('common.bulkActions', { defaultValue: 'Hành động hàng loạt' })}>
      <span className="font-semibold text-sm">{countLabel}</span>
      {showSelectAll && (
        <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onSelectAllMatching}>
          {t('common.selectAllMatching', { count: totalMatching, defaultValue: `Chọn tất cả ${totalMatching} kết quả khớp` })}
        </Button>
      )}
      {allMatchingSelected && typeof totalMatching === 'number' && (
        <span className="text-xs text-muted-foreground">
          {t('common.allMatchingSelected', { count: totalMatching, defaultValue: `Đã chọn tất cả ${totalMatching} kết quả` })}
        </span>
      )}
      <span className="h-6 w-px bg-border" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action, index) => (
          <Button
            key={index}
            type="button"
            variant={action.tone === 'danger' ? 'danger' : 'ghost'}
            size="sm"
            className="min-h-11"
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            loading={action.loading}
          >
            {action.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={onClear}
          aria-label={close}
          title={close}
        >
          <X size={13} />
        </Button>
      </div>
    </div>
  )
}
