import { useTranslation } from 'react-i18next'
import { Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// T7 — dropdown "Cột hiển thị" dùng chung cho mọi AdminTable. Ghép với
// useColumnVisibility (lib/useColumnVisibility.js): screen tự lọc `columns`
// truyền vào AdminTable, component này chỉ render UI bật/tắt.
export function ColumnVisibilityToggle({ allColumns, hiddenKeys, onToggle }) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Columns3 size={14} aria-hidden="true" />
          {t('common.columns', { defaultValue: 'Cột hiển thị' })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('common.columns', { defaultValue: 'Cột hiển thị' })}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allColumns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={!hiddenKeys.includes(column.key)}
            onCheckedChange={() => onToggle(column.key)}
            onSelect={(e) => e.preventDefault()}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
