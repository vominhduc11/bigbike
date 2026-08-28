import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { SortableRow } from '../../components/Sortable'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { TableCell, TableRow } from '@/components/ui/table'

export function SortableMenuItem({
  item, displayLabel, parentLabel, rootLabel, canUpdate, onEdit, onDelete, isDeleting,
  selected, onToggleSelect, onToggleStatus, isToggling, hiddenKeys = [],
}) {
  const { t } = useTranslation()
  const isInactive = item.status === 'INACTIVE'
  const itemName = displayLabel ?? item.label ?? ''

  return (
    <SortableRow id={item.id}>
      {(sortable) => (
    <TableRow
      ref={sortable.setNodeRef}
      style={sortable.style}
      className={cn(isInactive && 'is-inactive', sortable.isDragging && 'opacity-40')}
    >
      {canUpdate && onToggleSelect && (
        <TableCell className="menu-grip-cell">
          <Checkbox
            checked={Boolean(selected)}
            onCheckedChange={onToggleSelect}
            aria-label={t('menus.selectItemAria', { name: itemName, defaultValue: 'Chọn mục {{name}}' })}
          />
        </TableCell>
      )}
      <TableCell className="menu-grip-cell">
        {canUpdate && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="menu-grab-btn shrink-0 cursor-grab"
            title={t('menus.dragReorderTitle', { defaultValue: 'Kéo để sắp xếp (cùng cấp)' })}
            aria-label={t('menus.dragReorderItemAria', { name: itemName, defaultValue: 'Kéo để sắp xếp mục {{name}}' })}
            {...sortable.handleProps}
          >
            <GripVertical size={15} />
          </Button>
        )}
      </TableCell>
      <TableCell style={{ paddingLeft: `${8 + item.depth * 16}px` }}>
        <div className="menu-item-label-cell">
          {item.depth > 0 && (
            <span className="menu-item-depth">L{item.depth + 1}</span>
          )}
          <span className="menu-item-name">{displayLabel ?? item.label}</span>
          {canUpdate && onToggleStatus ? (
            <Switch
              checked={!isInactive}
              onCheckedChange={() => onToggleStatus(item)}
              disabled={isToggling}
              title={isInactive
                ? t('menus.showItemTitle', { defaultValue: 'Bật hiển thị mục này' })
                : t('menus.hideItemTitle', { defaultValue: 'Ẩn mục này' })}
              aria-label={isInactive
                ? t('menus.showItemAria', { name: itemName, defaultValue: 'Bật hiển thị mục {{name}}' })
                : t('menus.hideItemAria', { name: itemName, defaultValue: 'Ẩn mục {{name}}' })}
              className="shrink-0"
            />
          ) : (
            isInactive && <span className="menu-item-badge-inactive">{t('menus.itemHiddenBadge', { defaultValue: 'Ẩn' })}</span>
          )}
        </div>
      </TableCell>
      {!hiddenKeys.includes('parent') && (
        <TableCell>
          <span className="menu-item-parent-cell" title={parentLabel || rootLabel}>
            {parentLabel || <span className="text-muted-foreground">{rootLabel}</span>}
          </span>
        </TableCell>
      )}
      {!hiddenKeys.includes('url') && (
        <TableCell>
          <span className="menu-item-url-cell" title={item.url}>{item.url}</span>
        </TableCell>
      )}
      {canUpdate && (
        <TableCell className="menu-item-actions-cell">
          <div className="menu-row-actions">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onEdit(item)}
              title={t('menus.editItemTitle', { defaultValue: 'Chỉnh sửa mục này' })}
              aria-label={t('menus.editItemAria', { name: itemName, defaultValue: 'Sửa mục {{name}}' })}
              disabled={isDeleting}
            >
              <Pencil size={13} />
            </Button>
            <Button
              variant="danger"
              size="icon"
              onClick={() => onDelete(item.id)}
              title={t('menus.deleteItemActionTitle', { defaultValue: 'Xoá mục này' })}
              aria-label={t('menus.deleteItemAria', { name: itemName, defaultValue: 'Xoá mục {{name}}' })}
              loading={isDeleting}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
      )}
    </SortableRow>
  )
}
