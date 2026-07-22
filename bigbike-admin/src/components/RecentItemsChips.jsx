import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

// O9 — dải chip "Vừa xem gần đây" dùng chung cho các màn hình danh sách.
// Ghép với lib/useRecentItems.js: `items` đọc qua useRecentItems(storageKey),
// mỗi item ghi lại từ màn hình chi tiết tương ứng bằng recordRecentItem(storageKey, item).
export function RecentItemsChips({ items, onSelect }) {
  const { t } = useTranslation()
  const labelId = useId()
  if (!items?.length) return null

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      role="group"
      aria-labelledby={labelId}
    >
      <span id={labelId} className="inline-flex items-center gap-1 font-medium">
        <Clock size={12} aria-hidden="true" />
        {t('common.recentItems', { defaultValue: 'Vừa xem gần đây' })}
      </span>
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelect(item)}
          title={item.label}
          className="min-h-11 rounded-full bg-surface-muted px-3 font-normal text-foreground"
        >
          <span className="block max-w-40 truncate">{item.label}</span>
        </Button>
      ))}
    </div>
  )
}
