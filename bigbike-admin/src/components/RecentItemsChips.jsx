import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'

// O9 — dải chip "Vừa xem gần đây" dùng chung cho các màn hình danh sách.
// Ghép với lib/useRecentItems.js: `items` đọc qua useRecentItems(storageKey),
// mỗi item ghi lại từ màn hình chi tiết tương ứng bằng recordRecentItem(storageKey, item).
export function RecentItemsChips({ items, onSelect }) {
  const { t } = useTranslation()
  if (!items?.length) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1 font-medium">
        <Clock size={12} aria-hidden="true" />
        {t('common.recentItems', { defaultValue: 'Vừa xem gần đây' })}
      </span>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs text-foreground transition-colors hover:bg-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
