import { useTranslation } from 'react-i18next'
import { Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

// T7 — dropdown "Cột hiển thị" dùng chung cho mọi AdminTable. Ghép với
// useColumnVisibility (lib/useColumnVisibility.js): screen tự lọc `columns`
// truyền vào AdminTable, component này chỉ render UI bật/tắt.
export function ColumnVisibilityToggle({ allColumns, hiddenKeys, onToggle, className }) {
  const { t } = useTranslation()
  const visibleCount = allColumns.length - hiddenKeys.length
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn('gap-1.5', className)}>
          <Columns3 size={14} aria-hidden="true" />
          {t('common.columns', { defaultValue: 'Cột hiển thị' })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('common.columns', { defaultValue: 'Cột hiển thị' })}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allColumns.map((column) => {
          const checked = !hiddenKeys.includes(column.key)
          // Không cho tắt cột cuối cùng đang hiện — tránh bảng trống trơn không còn cột nào.
          const isLastVisible = checked && visibleCount === 1
          return (
            <DropdownMenuCheckboxItem
              key={column.key}
              checked={checked}
              disabled={isLastVisible}
              onCheckedChange={() => onToggle(column.key)}
              onSelect={(e) => e.preventDefault()}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          )
        })}
        {hiddenKeys.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => hiddenKeys.forEach((k) => onToggle(k))}>
              {t('common.showAllColumns', { defaultValue: 'Hiện tất cả cột' })}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
